import { adminClient, sha16 } from "./cors.ts";

export type LicenseErrorReason =
  | "invalid_key"
  | "not_found"
  | "revoked"
  | "expired"
  | "unused"
  | "device_mismatch"
  | "inactive";

export class LicenseError extends Error {
  reason: LicenseErrorReason;
  statusCode: number;
  constructor(reason: LicenseErrorReason, message: string, statusCode = 403) {
    super(message);
    this.reason = reason;
    this.statusCode = statusCode;
  }
}

export type LicenseRow = {
  key: string;
  plan: string;
  status: string;
  duration_days: number;
  activated_at: string | null;
  expires_at: string | null;
  bound_email: string | null;
  hwid: string | null;
  revoked: boolean;
  source: string;
};

export async function validateKey(
  key: string | null | undefined,
  opts: {
    email?: string | null;
    hwid?: string | null;
    bind?: boolean;
    allowUnused?: boolean;
  } = {},
): Promise<LicenseRow & { license_hash: string; days_remaining: number; hours_remaining: number }> {
  const trimmed = (key || "").trim().toUpperCase();
  if (!trimmed) throw new LicenseError("invalid_key", "Chave vazia", 401);

  const sb = adminClient();
  const { data: row, error } = await sb
    .from("licenses")
    .select("*")
    .eq("key", trimmed)
    .maybeSingle();

  if (error) throw new LicenseError("invalid_key", error.message, 500);
  if (!row) throw new LicenseError("not_found", "License not found", 404);

  const lic = row as LicenseRow;

  if (lic.revoked || lic.status === "revoked") {
    throw new LicenseError("revoked", "License has been revoked", 403);
  }

  if (lic.status === "unused" && !opts.allowUnused) {
    throw new LicenseError(
      "unused",
      "Licença ainda não ativada. Ative em infinitylov /ativar-licenca",
      403,
    );
  }

  if (lic.status === "expired") {
    throw new LicenseError("expired", "License has expired", 403);
  }

  if (lic.expires_at) {
    const exp = new Date(lic.expires_at).getTime();
    if (exp < Date.now()) {
      await sb.from("licenses").update({ status: "expired" }).eq("key", trimmed);
      throw new LicenseError("expired", "License has expired", 403);
    }
  }

  // Active licenses without expires_at (shouldn't happen) — ok
  if (lic.status !== "active" && lic.status !== "unused") {
    throw new LicenseError("inactive", `License status: ${lic.status}`, 403);
  }

  const hwid = opts.hwid || null;
  if (hwid && lic.hwid && lic.hwid !== hwid) {
    throw new LicenseError(
      "device_mismatch",
      "License is already activated on another device",
      403,
    );
  }

  if (opts.bind && hwid && !lic.hwid) {
    await sb.from("licenses").update({ hwid }).eq("key", trimmed).is("hwid", null);
    lic.hwid = hwid;
  }

  if (opts.email && !lic.bound_email) {
    await sb
      .from("licenses")
      .update({ bound_email: opts.email })
      .eq("key", trimmed)
      .is("bound_email", null);
    lic.bound_email = opts.email;
  }

  let days_remaining = 365;
  let hours_remaining = 365 * 24;
  if (lic.expires_at) {
    const ms = new Date(lic.expires_at).getTime() - Date.now();
    days_remaining = Math.max(0, ms / 86400000);
    hours_remaining = Math.max(0, ms / 3600000);
  }

  return {
    ...lic,
    license_hash: await sha16(trimmed),
    days_remaining,
    hours_remaining,
  };
}

export async function loadExtensionConfig() {
  const sb = adminClient();
  const { data } = await sb.from("extension_config").select("*").eq("id", 1).maybeSingle();
  if (!data) {
    return {
      version: 5,
      intent: "visual_edit",
      transform_mode: "visual_edit",
      features: { transform: true, hide_security_ui: true },
      support: { whatsapp_url: "https://w.app/lovableilimitado" },
    };
  }
  return {
    version: data.version,
    intent: data.intent,
    transform_mode: data.transform_mode,
    features: data.features,
    support: data.support,
  };
}
