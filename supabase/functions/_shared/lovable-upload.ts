/** Proxy Lovable native file upload (GCS) — Origin: lovable.dev */

export type LovableUploadInput = {
  token: string;
  projectId: string;
  fileName: string;
  contentType: string;
  /** raw base64 or data-URL base64 */
  fileDataB64: string;
  sessionId?: string;
  gitSha?: string;
};

export type LovableUploadResult = {
  file_id: string;
  file_name: string;
  mime_type: string;
  download_url: string | null;
};

function decodeBase64(input: string): Uint8Array {
  const b64 = input.includes(",") ? input.split(",").pop()! : input;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function authHeaders(token: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Origin: "https://lovable.dev",
    Referer: "https://lovable.dev/",
    Accept: "application/json",
    ...extra,
  };
}

/**
 * Native Lovable 3-step upload:
 * 1) generate-upload-url
 * 2) PUT bytes to signed GCS URL
 * 3) generate-download-url (for optimisticImageUrls)
 */
export async function uploadToLovableGcs(input: LovableUploadInput): Promise<LovableUploadResult> {
  const token = input.token.replace(/^Bearer\s+/i, "").trim();
  const projectId = String(input.projectId || "").trim();
  const fileName = String(input.fileName || "file").trim() || "file";
  const contentType = String(input.contentType || "application/octet-stream").trim() ||
    "application/octet-stream";

  if (!token) throw new Error("token ausente");
  if (!projectId) throw new Error("projectId ausente");
  if (!input.fileDataB64) throw new Error("file_data ausente");

  let raw: Uint8Array;
  try {
    raw = decodeBase64(input.fileDataB64);
  } catch {
    throw new Error("file_data base64 inválido");
  }
  if (!raw.byteLength) throw new Error("arquivo vazio");
  // Edge Functions body limit ~6MB JSON; keep a hard cap for GCS uploads
  if (raw.byteLength > 8 * 1024 * 1024) {
    throw new Error("arquivo muito grande (máx. 8MB)");
  }

  const sessionHeaders: Record<string, string> = {};
  if (input.sessionId) sessionHeaders["x-lovable-session-id"] = input.sessionId;
  if (input.gitSha) sessionHeaders["x-client-git-sha"] = input.gitSha;

  const genResp = await fetch(
    `https://api.lovable.dev/projects/${encodeURIComponent(projectId)}/files/generate-upload-url`,
    {
      method: "POST",
      headers: authHeaders(token, {
        "Content-Type": "application/json",
        ...sessionHeaders,
      }),
      body: JSON.stringify({
        file_name: fileName,
        content_type: contentType,
      }),
    },
  );
  const genText = await genResp.text();
  let genJson: Record<string, unknown> = {};
  try {
    genJson = JSON.parse(genText);
  } catch {
    /* raw */
  }
  if (!genResp.ok) {
    throw new Error(
      `generate-upload-url ${genResp.status}: ${
        (genJson as { error?: string; message?: string }).error ||
        (genJson as { message?: string }).message ||
        genText.slice(0, 300)
      }`,
    );
  }

  const uploadUrl = String(genJson.url || "");
  const fileId = String(genJson.file_id || "");
  if (!uploadUrl || !fileId) {
    throw new Error("generate-upload-url sem url/file_id");
  }

  const putHeadersRaw = (genJson.headers && typeof genJson.headers === "object")
    ? { ...(genJson.headers as Record<string, string>) }
    : {};
  if (!putHeadersRaw["Content-Type"] && !putHeadersRaw["content-type"]) {
    putHeadersRaw["Content-Type"] = contentType;
  }

  const putResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: putHeadersRaw,
    body: raw,
  });
  if (!(putResp.ok || putResp.status === 200 || putResp.status === 201 || putResp.status === 204)) {
    const putErr = await putResp.text().catch(() => "");
    throw new Error(`GCS PUT ${putResp.status}: ${putErr.slice(0, 300)}`);
  }

  // Signed download URL for optimisticImageUrls (images) — best effort
  let downloadUrl: string | null = null;
  try {
    const uuid = fileId.includes("/") ? fileId.split("/").pop()! : fileId;
    const dlResp = await fetch("https://api.lovable.dev/files/generate-download-url", {
      method: "POST",
      headers: authHeaders(token, {
        "Content-Type": "application/json",
        ...sessionHeaders,
      }),
      body: JSON.stringify({
        dir_name: projectId,
        file_name: uuid,
      }),
    });
    if (dlResp.ok) {
      const dlJson = await dlResp.json();
      downloadUrl = dlJson.url || null;
    }
  } catch {
    /* optional */
  }

  return {
    file_id: fileId,
    file_name: fileName,
    mime_type: contentType,
    download_url: downloadUrl,
  };
}
