import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireStaff } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const gate = await requireStaff(req, ["super_admin", "admin", "support"]);
  if ("error" in gate) return gate.error;

  const body = await req.json();
  const key = String(body.license_key || body.key || "").trim().toUpperCase();
  if (!key) return jsonResponse({ ok: false, error: "key required" }, 400);

  const { error } = await gate.sb.from("licenses").update({ hwid: null }).eq("key", key);
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);
  return jsonResponse({ ok: true, key, hwid: null });
});
