import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { LicenseError, loadExtensionConfig, validateKey } from "../_shared/license.ts";
import { stripInternalMeta, transformChatBody } from "../_shared/transform.ts";

async function proxyLovableChat(opts: {
  token: string;
  projectId: string;
  chatBody: Record<string, unknown>;
  sessionId?: string;
  gitSha?: string;
}): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    "Content-Type": "application/json",
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    Accept: "text/event-stream, application/json",
  };
  if (opts.sessionId) headers["x-lovable-session-id"] = opts.sessionId;
  if (opts.gitSha) headers["x-client-git-sha"] = opts.gitSha;

  const url = `https://api.lovable.dev/projects/${opts.projectId}/chat`;
  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.chatBody),
  });
  const text = await resp.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 800) || `HTTP ${resp.status}` };
  }
  return { status: resp.status, data };
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const payload = await req.json();
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
          success: false,
          error: `license_invalid: ${e.message}`,
          reason: e.reason,
        });
      }
      throw e;
    }

    const token = String(payload.token || payload.token_lovable || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    const projectId = payload.projectId || payload.projeto_id;
    const message = payload.message || payload.mensagem || "";
    const hasFiles = Boolean(
      (Array.isArray(payload.files) && payload.files.length) ||
        (Array.isArray(payload.attachedFiles) && payload.attachedFiles.length) ||
        (Array.isArray(payload.optimisticImageUrls) && payload.optimisticImageUrls.length) ||
        (Array.isArray(payload.imageUrls) && payload.imageUrls.length),
    );
    if (!token || !projectId || (!message && !hasFiles)) {
      return jsonResponse(
        { ok: false, success: false, error: "token, projectId ou message/anexo ausente" },
        400,
      );
    }

    const cfg = await loadExtensionConfig();
    const lastPayload =
      payload.lastPayload && typeof payload.lastPayload === "object"
        ? { ...payload.lastPayload }
        : {};
    const chatBody: Record<string, unknown> = { ...lastPayload };
    chatBody.message = message;
    chatBody.chat_only = false;
    if (payload.files) chatBody.files = payload.files;
    if (payload.attachedFiles) chatBody.files = chatBody.files || payload.attachedFiles;
    if (payload.imageUrls || payload.optimisticImageUrls) {
      chatBody.optimisticImageUrls = payload.imageUrls || payload.optimisticImageUrls;
    }
    for (const k of ["id", "ai_message_id", "client_id"]) {
      if (payload[k]) chatBody[k] = payload[k];
    }

    const transformed = stripInternalMeta(
      transformChatBody(chatBody, {
        intent: cfg.intent,
        transform_mode: cfg.transform_mode,
      }),
    );

    const { status, data } = await proxyLovableChat({
      token,
      projectId: String(projectId),
      chatBody: transformed,
      sessionId: String(
        payload.browser_session_id ||
          payload.lovable_browser_session_id ||
          payload.sessionId ||
          "",
      ),
      gitSha: String(
        payload.client_git_sha || payload.lovable_git_sha || payload.gitSha || "",
      ),
    });

    const ok = (status >= 200 && status < 300) || status === 202;
    if (!ok) {
      return jsonResponse(
        { ok: false, success: false, status, error: String(data) },
        status || 502,
      );
    }
    return jsonResponse({
      ok: true,
      success: true,
      status: 202,
      data: { status: "started" },
    });
  } catch (e) {
    return jsonResponse({ ok: false, success: false, error: String(e) }, 500);
  }
});
