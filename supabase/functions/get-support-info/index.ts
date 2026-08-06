import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { loadExtensionConfig } from "../_shared/license.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const cfg = await loadExtensionConfig();
  const support = (cfg.support || {}) as Record<string, string>;
  return jsonResponse({
    whatsapp_url: support.whatsapp_url || "https://w.app/lovableilimitado",
  });
});
