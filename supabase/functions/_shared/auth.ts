import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { adminClient, jsonResponse } from "./cors.ts";

export type StaffRole = "super_admin" | "admin" | "support" | "reseller" | "member";

export type AuthOk = {
  user: User;
  role: string;
  sb: SupabaseClient;
};

export type AuthFail = { error: Response };

export async function requireUser(req: Request): Promise<AuthOk | AuthFail> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return { error: jsonResponse({ ok: false, error: "Unauthorized" }, 401) };

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { error: jsonResponse({ ok: false, error: "Unauthorized" }, 401) };

  const sb = adminClient();
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = profile?.role || user.app_metadata?.role || "member";
  return { user, role, sb };
}

export async function requireStaff(
  req: Request,
  roles: string[],
): Promise<AuthOk | AuthFail> {
  const gate = await requireUser(req);
  if ("error" in gate) return gate;
  if (!roles.includes(gate.role)) {
    return { error: jsonResponse({ ok: false, error: "Forbidden" }, 403) };
  }
  return gate;
}
