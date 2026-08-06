import { handleOptions, jsonResponse, adminClient } from "../_shared/cors.ts";

function randomPassword(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const key = String(body.license_key || body.key || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();

    if (!key || !email || !email.includes("@")) {
      return jsonResponse({ ok: false, error: "Informe chave e e-mail." }, 400);
    }

    const sb = adminClient();
    const { data: lic, error: licErr } = await sb.from("licenses").select("*").eq("key", key).maybeSingle();
    if (licErr) return jsonResponse({ ok: false, error: licErr.message }, 500);
    if (!lic) return jsonResponse({ ok: false, error: "Licença não encontrada." }, 404);
    if (lic.revoked || lic.status === "revoked") {
      return jsonResponse({ ok: false, error: "Licença revogada." }, 403);
    }
    if (lic.status === "active" && lic.user_id) {
      return jsonResponse({ ok: false, error: "Licença já ativada." }, 409);
    }
    if (lic.status !== "unused") {
      return jsonResponse({ ok: false, error: `Status inválido: ${lic.status}` }, 400);
    }

    const { data: profile } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();
    let userId: string;

    if (profile?.id) {
      const { data: own } = await sb
        .from("licenses")
        .select("key")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .limit(1);
      if (own && own.length > 0) {
        return jsonResponse({ ok: false, error: "Este e-mail já possui acesso ativo." }, 409);
      }
      userId = profile.id;
    } else {
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        app_metadata: { role: "member" },
      });
      if (createErr || !created.user) {
        return jsonResponse({ ok: false, error: createErr?.message || "Falha ao criar usuário." }, 400);
      }
      userId = created.user.id;
      await sb.from("profiles").upsert({ id: userId, email, role: "member" });
    }

    const duration = lic.duration_days || 30;
    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt.getTime() + duration * 86400000);

    const { data: updated, error: updErr } = await sb
      .from("licenses")
      .update({
        status: "active",
        user_id: userId,
        bound_email: email,
        activated_at: activatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("key", key)
      .eq("status", "unused")
      .select("key")
      .maybeSingle();

    if (updErr) return jsonResponse({ ok: false, error: updErr.message }, 500);
    if (!updated) return jsonResponse({ ok: false, error: "Licença já foi ativada por outro." }, 409);

    const { data: plan } = await sb.from("plans").select("id").eq("code", "plan_1").maybeSingle();
    if (plan?.id) {
      await sb.from("subscriptions").insert({
        user_id: userId,
        plan_id: plan.id,
        status: "active",
        starts_at: activatedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      });
    }

    return jsonResponse({
      ok: true,
      activated: true,
      expires_at: expiresAt.toISOString(),
      license_key: key,
      message: "Licença ativada. Use a extensão Chrome com a mesma chave.",
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
