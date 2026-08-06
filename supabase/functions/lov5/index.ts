import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { LicenseError, loadExtensionConfig, validateKey } from "../_shared/license.ts";
import { uploadToLovableGcs } from "../_shared/lovable-upload.ts";
import { stripInternalMeta, transformChatBody } from "../_shared/transform.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const payload = await req.json();
    const action = String(payload.action || "transform").toLowerCase();
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

    if (action === "upload") {
      const token = String(payload.token || payload.token_lovable || "")
        .replace(/^Bearer\s+/i, "")
        .trim();
      const projectId = String(payload.projectId || payload.projeto_id || "").trim();
      const fileName = String(payload.file_name || payload.fileName || "file");
      const contentType = String(
        payload.content_type || payload.contentType || "application/octet-stream",
      );
      const fileData = String(payload.file_data || payload.fileData || "");

      if (!token || !projectId || !fileData) {
        return jsonResponse({
          ok: false,
          error: "token, projectId ou file_data ausente",
          action: "upload",
        }, 400);
      }

      try {
        const result = await uploadToLovableGcs({
          token,
          projectId,
          fileName,
          contentType,
          fileDataB64: fileData,
          sessionId: String(
            payload.browser_session_id ||
              payload.lovable_browser_session_id ||
              payload.sessionId ||
              "",
          ) || undefined,
          gitSha: String(
            payload.client_git_sha || payload.lovable_git_sha || payload.gitSha || "",
          ) || undefined,
        });
        return jsonResponse({
          ok: true,
          action: "upload",
          file_id: result.file_id,
          file_name: result.file_name,
          mime_type: result.mime_type,
          download_url: result.download_url,
        });
      } catch (e) {
        return jsonResponse({
          ok: false,
          error: String(e instanceof Error ? e.message : e),
          action: "upload",
        }, 502);
      }
    }

    return jsonResponse({
      ok: false,
      error: "Ação inválida. Use action: transform | upload. Envio de chat: /send-lovable-prompt.",
      action,
    }, 400);
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
