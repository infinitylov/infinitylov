import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { LicenseError, loadExtensionConfig, validateKey } from "../_shared/license.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const key = body.key || body.license_key;
    // Match prototype: bind hwid only when provided (license.js often omits hwid)
    const lic = await validateKey(key, {
      email: body.email,
      hwid: body.hwid || null,
      bind: Boolean(body.hwid),
    });
    const config = await loadExtensionConfig();
    return jsonResponse({
      config,
      license: {
        plan: lic.plan,
        expires_at: lic.expires_at,
        bound_email: lic.bound_email,
        license_hash: lic.license_hash,
      },
    });
  } catch (e) {
    if (e instanceof LicenseError) {
      return jsonResponse(
        { error: e.message, reason: e.reason, detail: e.message },
        e.statusCode,
      );
    }
    return jsonResponse({ error: String(e) }, 500);
  }
});
