import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

function generateKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `INLO-${part()}-${part()}-${part()}`;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const gate = await requireUser(req);
  if ("error" in gate) return gate.error;

  const { user, role, sb } = gate;

  const body = await req.json();
  const quantity = Math.min(Math.max(Number(body.quantity) || 0, 1), 500);
  const durationDays = Math.min(Math.max(Number(body.duration_days) || 30, 1), 3650);
  const label = body.label ? String(body.label) : null;

  const isAdmin = role === "super_admin" || role === "admin";
  let resellerId: string | null = null;

  if (!isAdmin) {
    if (role !== "reseller") {
      return jsonResponse({ ok: false, error: "Forbidden" }, 403);
    }
    const { data: reseller } = await sb
      .from("resellers")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    if (!reseller) return jsonResponse({ ok: false, error: "Revendedor inativo." }, 403);
    if ((reseller.credits_remaining || 0) < quantity) {
      return jsonResponse({
        ok: false,
        error: `Créditos insuficientes (${reseller.credits_remaining}).`,
      }, 400);
    }
    resellerId = reseller.id;

    const { error: debitErr } = await sb
      .from("resellers")
      .update({
        credits_remaining: reseller.credits_remaining - quantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reseller.id)
      .eq("credits_remaining", reseller.credits_remaining);
    if (debitErr) return jsonResponse({ ok: false, error: debitErr.message }, 500);
  }

  const { data: batch, error: batchErr } = await sb
    .from("license_batches")
    .insert({
      reseller_id: resellerId,
      created_by: user.id,
      quantity,
      duration_days: durationDays,
      label,
    })
    .select("*")
    .single();
  if (batchErr) return jsonResponse({ ok: false, error: batchErr.message }, 500);

  const { data: plan } = await sb.from("plans").select("id").eq("code", "plan_1").maybeSingle();
  const rows = Array.from({ length: quantity }, () => ({
    key: generateKey(),
    plan: "plan_1",
    plan_id: plan?.id || null,
    status: "unused",
    duration_days: durationDays,
    source: isAdmin ? "admin" : "reseller",
    batch_id: batch.id,
    reseller_id: resellerId,
  }));

  const { data: created, error: insErr } = await sb.from("licenses").insert(rows).select("key, status, duration_days");
  if (insErr) return jsonResponse({ ok: false, error: insErr.message }, 500);

  return jsonResponse({
    ok: true,
    batch_id: batch.id,
    quantity,
    duration_days: durationDays,
    keys: (created || []).map((r) => r.key),
  });
});
