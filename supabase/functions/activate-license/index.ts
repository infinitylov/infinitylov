import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleOptions, jsonResponse, adminClient } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const key = String(body.license_key || body.key || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!key || !email || password.length < 8) {
      return jsonResponse({ ok: false, error: "Informe chave, e-mail e senha (mín. 8)." }, 400);
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
      await sb.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        password,
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

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: sessionData, error: signErr } = await anon.auth.signInWithPassword({ email, password });
    if (signErr) {
      return jsonResponse({
        ok: true,
        activated: true,
        message: "Licença ativada. Faça login com e-mail e senha.",
        expires_at: expiresAt.toISOString(),
      });
    }

    return jsonResponse({
      ok: true,
      activated: true,
      expires_at: expiresAt.toISOString(),
      license_key: key,
      session: sessionData.session,
      user: sessionData.user,
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
