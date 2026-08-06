import { handleOptions, jsonResponse, adminClient } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return jsonResponse({ ok: false, error: "Informe um e-mail válido." }, 400);
    }

    const sb = adminClient();
    const { data, error } = await sb
      .from("licenses")
      .select("key, expires_at, source, status")
      .ilike("bound_email", email)
      .eq("status", "active")
      .order("activated_at", { ascending: false })
      .limit(20);

    if (error) return jsonResponse({ ok: false, error: error.message }, 500);

    const licenses = (data || []).map((row) => ({
      key: row.key as string,
      expires_at: (row.expires_at as string | null) ?? null,
      source: (row.source as string | null) ?? null,
    }));

    if (licenses.length === 0) {
      return jsonResponse({
        ok: true,
        licenses: [],
        message: "Nenhuma licença ativa para este e-mail.",
      });
    }

    return jsonResponse({ ok: true, licenses });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
