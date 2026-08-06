import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { validateKey, LicenseError } from "../_shared/license.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  try {
    let key: string | null = null;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      key = body.license_key || body.key || null;
    } else {
      key = new URL(req.url).searchParams.get("key");
    }

    if (key) {
      await validateKey(key, { allowUnused: false });
    }

    // MVP: sidepanel compat — lista vazia até haver catálogo de templates
    return jsonResponse({ ok: true, templates: [] });
  } catch (e) {
    if (e instanceof LicenseError) {
      return jsonResponse({ ok: false, error: e.reason, message: e.message, templates: [] }, e.statusCode);
    }
    return jsonResponse({ ok: false, error: String(e), templates: [] }, 500);
  }
});
