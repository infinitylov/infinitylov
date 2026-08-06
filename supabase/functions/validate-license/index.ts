import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { LicenseError, validateKey } from "../_shared/license.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const key = body.license_key || body.key;
    const lic = await validateKey(key, {
      email: body.email,
      hwid: body.hwid,
      bind: true,
    });
    return jsonResponse({
      status: "valid",
      session_token: lic.license_hash,
      days_remaining: lic.days_remaining,
      hours_remaining: lic.hours_remaining,
      license_id: lic.license_hash,
      plan: lic.plan,
      expires_at: lic.expires_at,
    });
  } catch (e) {
    if (e instanceof LicenseError) {
      const status =
        e.reason === "invalid_key" || e.reason === "not_found" ? "not_found" : e.reason;
      return jsonResponse({ status, message: e.message });
    }
    return jsonResponse({ status: "error", message: String(e) }, 500);
  }
});
