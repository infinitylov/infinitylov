import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireStaff } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const gate = await requireStaff(req, ["super_admin", "admin"]);
  if ("error" in gate) return gate.error;

  try {
    const body = await req.json();
    const userId = body.user_id ? String(body.user_id) : null;
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    const credits = Math.max(0, Number(body.credits) || 0);
    const notes = body.notes ? String(body.notes) : null;
    const active = body.active === undefined ? true : Boolean(body.active);

    if (!userId && !email) {
      return jsonResponse({ ok: false, error: "Informe user_id ou email." }, 400);
    }

    const { sb } = gate;
    let targetId = userId;

    if (!targetId && email) {
      const { data: profile } = await sb
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (!profile?.id) {
        return jsonResponse({ ok: false, error: "Usuário não encontrado." }, 404);
      }
      targetId = profile.id;
    }

    const { error: roleErr } = await sb
      .from("profiles")
      .update({ role: "reseller", updated_at: new Date().toISOString() })
      .eq("id", targetId!);
    if (roleErr) return jsonResponse({ ok: false, error: roleErr.message }, 500);

    await sb.auth.admin.updateUserById(targetId!, {
      app_metadata: { role: "reseller" },
    });

    const { data: existing } = await sb
      .from("resellers")
      .select("*")
      .eq("user_id", targetId!)
      .maybeSingle();

    let reseller;
    if (existing) {
      const nextCredits = credits > 0
        ? (existing.credits_remaining || 0) + credits
        : existing.credits_remaining;
      const nextLifetime = credits > 0
        ? (existing.credits_lifetime || 0) + credits
        : existing.credits_lifetime;
      const { data, error } = await sb
        .from("resellers")
        .update({
          credits_remaining: nextCredits,
          credits_lifetime: nextLifetime,
          active,
          notes: notes ?? existing.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      reseller = data;
    } else {
      const { data, error } = await sb
        .from("resellers")
        .insert({
          user_id: targetId!,
          credits_remaining: credits,
          credits_lifetime: credits,
          active,
          notes,
        })
        .select("*")
        .single();
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      reseller = data;
    }

    return jsonResponse({
      ok: true,
      user_id: targetId,
      role: "reseller",
      reseller,
      credits_added: credits,
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
