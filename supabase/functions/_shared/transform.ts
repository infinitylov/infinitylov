const ULID_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export function generateUlid(): string {
  let ts = Date.now();
  let tsPart = "";
  for (let i = 0; i < 10; i++) {
    tsPart = ULID_ALPHABET[ts % 32] + tsPart;
    ts = Math.floor(ts / 32);
  }
  let rand = "";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  for (let i = 0; i < 16; i++) rand += ULID_ALPHABET[bytes[i] % 32];
  return tsPart + rand;
}

function framePromptForFastVisual(prompt: string): string {
  const p = (prompt || "").trim();
  if (!p) return "Improve the current page layout and clarity.";
  const low = p.toLowerCase();
  const isQuestion =
    p.endsWith("?") ||
    /^(o que|do que|de que|qual |quais |como |por que|porque|porquê|explique|me explique|me diga|me fala|descreva|what |how |why |explain)/i
      .test(low);
  if (isQuestion) {
    return (
      "Create or update a visible summary/callout section on the current page " +
      "that answers this question about the project/dashboard/report, using the " +
      "real purpose and data of the app. Do NOT change the main title to the " +
      `question text. Question: ${p}`
    );
  }
  return `Apply this user request fully to the project (UI and code as needed). Request: ${p}`;
}

function extractUserPrompt(body: Record<string, unknown>): string {
  for (const key of ["message", "prompt", "text", "content"]) {
    const val = body[key];
    if (typeof val === "string" && val.trim()) {
      if (val.startsWith("Apply these visual text edits:")) {
        const m = val.match(/Change text from "((?:\\.|[^"\\])*)" to "/);
        if (m) return m[1].replace(/\\"/g, '"').trim();
      }
      return val.trim();
    }
  }
  return "";
}

function applyVisualEdit(
  out: Record<string, unknown>,
  userPrompt: string,
): Record<string, unknown> {
  const original = (userPrompt || "Improve the current page").trim();
  const framed = framePromptForFastVisual(original);
  const editText = framed.length <= 700 ? framed : framed.slice(0, 697) + "...";
  const filePath = "/src/routes/index.tsx";

  out.selected_elements = [
    {
      filePath,
      elementType: "body",
      componentName: "body",
      lineNumber: 1,
      children: null,
      textContent: editText,
    },
  ];
  out.intent = "visual_edit";
  out.view = out.view || "preview";
  out.session_replay = "[]";
  out.chat_only = false;
  out.contains_error = false;
  out.from_queue = false;
  out.from_agent = false;
  out.current_page = out.current_page || "/";
  out.message =
    "Apply these visual text edits:\n" +
    `1. Change text from "${editText}" to "${editText}" ` +
    `(on element "body" at "${filePath}:1")`;
  out.message_intent_metadata = {
    visual_edit_metadata: {
      text_replacements: [
        {
          old_text: editText,
          new_text: editText,
          selected_element_index: 0,
        },
      ],
    },
  };
  delete out.integration_metadata;
  delete out.view_description;
  out.files = out.files || [];
  out.optimisticImageUrls = out.optimisticImageUrls || [];
  delete out.error_ids;
  return out;
}

export function transformChatBody(
  body: Record<string, unknown>,
  opts: { intent?: string; transform_mode?: string } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(body || {}) };
  const userPrompt = extractUserPrompt(out);

  if (!(typeof out.id === "string" && String(out.id).startsWith("umsg_"))) {
    out.id = "umsg_" + generateUlid();
  }
  if (!(typeof out.ai_message_id === "string" && String(out.ai_message_id).startsWith("aimsg_"))) {
    out.ai_message_id = "aimsg_" + generateUlid();
  }

  out.chat_only = false;
  out.model = null;
  out.thread_id = out.thread_id || "main";
  out.client_logs = [];
  out.network_requests = [];
  out.runtime_errors = [];
  delete out.contains_error;
  delete out.error_ids;
  delete out.dispatch_mode;

  const mode = (opts.transform_mode || opts.intent || "visual_edit").toLowerCase();
  if (["visual_edit", "visual", "edicao_visual", "lvfe"].includes(mode)) {
    return applyVisualEdit(out, userPrompt);
  }

  // fallback: still visual_edit (MVP)
  return applyVisualEdit(out, userPrompt);
}

export function stripInternalMeta(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  delete out._pulse_meta;
  delete out._internal;
  return out;
}
