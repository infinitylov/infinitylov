import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { LicenseError, loadExtensionConfig, validateKey } from "../_shared/license.ts";
import { stripInternalMeta, transformChatBody } from "../_shared/transform.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const payload = await req.json();
    const action = payload.action || "transform";
    const licenseKey = payload.license_key || payload.key;

    try {
      await validateKey(licenseKey, {
        email: payload.email,
        hwid: payload.hwid || null,
        bind: false,
      });
    } catch (e) {
      if (e instanceof LicenseError) {
        return jsonResponse({
          ok: false,
          error: `license_invalid: ${e.message}`,
          reason: e.reason,
          logout: true,
        }, 403);
      }
      throw e;
    }

    if (action === "transform" || action === "enhance") {
      const cfg = await loadExtensionConfig();
      const body = payload.body && typeof payload.body === "object" ? payload.body : {};
      const transformed = stripInternalMeta(
        transformChatBody(body, {
          intent: cfg.intent,
          transform_mode: cfg.transform_mode,
        }),
      );
      return jsonResponse({ ok: true, action: "transform", body: transformed });
    }

    // Fallback: treat as send-lovable-prompt shape
    return jsonResponse({
      ok: false,
      error: "Use /send-lovable-prompt for send. lov5 supports transform.",
      action,
    }, 400);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
