import { handleOptions, jsonResponse, adminClient } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.full_name || body.name || "").trim();

    if (!email || !email.includes("@")) {
      return jsonResponse({ ok: false, error: "E-mail inválido." }, 400);
    }
    if (password.length < 8) {
      return jsonResponse({ ok: false, error: "Senha com no mínimo 8 caracteres." }, 400);
    }

    const sb = adminClient();

    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || null },
      app_metadata: { role: "reseller" },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message || "Falha ao criar conta.";
      const status = /already|registered|exists/i.test(msg) ? 409 : 400;
      return jsonResponse({ ok: false, error: msg }, status);
    }

    const userId = created.user.id;

    await sb.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName || null,
      role: "reseller",
      updated_at: new Date().toISOString(),
    });

    const { data: existing } = await sb
      .from("resellers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existing) {
      const { error: resErr } = await sb.from("resellers").insert({
        user_id: userId,
        credits_remaining: 0,
        credits_lifetime: 0,
        active: true,
        notes: "self-register",
      });
      if (resErr) {
        return jsonResponse({ ok: false, error: resErr.message }, 500);
      }
    }

    return jsonResponse({
      ok: true,
      user_id: userId,
      email,
      role: "reseller",
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
