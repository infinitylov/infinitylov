import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { getSaleStatus } from "../_shared/blackcat.ts";

async function creditReseller(
  sb: Awaited<ReturnType<typeof requireUser>> extends { sb: infer S } ? S : never,
  userId: string,
  credits: number,
) {
  const { data: reseller } = await sb
    .from("resellers")
    .select("id, credits_remaining, credits_lifetime")
    .eq("user_id", userId)
    .maybeSingle();
  if (!reseller) {
    await sb.from("resellers").insert({
      user_id: userId,
      credits_remaining: credits,
      credits_lifetime: credits,
      active: true,
      notes: "auto:blackcat-poll",
    });
    return;
  }
  await sb
    .from("resellers")
    .update({
      credits_remaining: (reseller.credits_remaining || 0) + credits,
      credits_lifetime: (reseller.credits_lifetime || 0) + credits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reseller.id);
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const gate = await requireUser(req);
  if ("error" in gate) return gate;
  const { user, role, sb } = gate;

  const isStaff = role === "super_admin" || role === "admin" || role === "support";
  const body = await req.json().catch(() => ({}));
  const orderId = String(body.order_id || "").trim();
  if (!orderId) return jsonResponse({ ok: false, error: "order_id obrigatório." }, 400);

  const { data: order, error } = await sb
    .from("credit_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (error) return jsonResponse({ ok: false, error: error.message }, 500);
  if (!order) return jsonResponse({ ok: false, error: "Pedido não encontrado." }, 404);
  if (!isStaff && order.reseller_user_id !== user.id) {
    return jsonResponse({ ok: false, error: "Forbidden" }, 403);
  }

  if (order.status === "paid") {
    return jsonResponse({
      ok: true,
      status: "paid",
      order_id: order.id,
      credits: order.credits,
      amount_cents: order.amount_cents,
    });
  }

  if (order.status !== "pending" || !order.provider_transaction_id) {
    return jsonResponse({
      ok: true,
      status: order.status,
      order_id: order.id,
    });
  }

  try {
    const remote = await getSaleStatus(order.provider_transaction_id);
    if (remote.status === "PAID") {
      if (remote.amount != null && remote.amount !== order.amount_cents) {
        return jsonResponse({ ok: false, error: "amount_mismatch" }, 400);
      }
      const now = new Date().toISOString();
      const { data: updated } = await sb
        .from("credit_orders")
        .update({
          status: "paid",
          paid_at: now,
          raw_webhook: remote.raw,
          updated_at: now,
        })
        .eq("id", order.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (updated) {
        await creditReseller(sb, order.reseller_user_id, order.credits);
      }

      return jsonResponse({
        ok: true,
        status: "paid",
        order_id: order.id,
        credits: order.credits,
        synced: Boolean(updated),
      });
    }

    if (remote.status === "CANCELLED" || remote.status === "FAILED" || remote.status === "EXPIRED") {
      await sb
        .from("credit_orders")
        .update({
          status: remote.status === "EXPIRED" ? "expired" : "cancelled",
          raw_webhook: remote.raw,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");
      return jsonResponse({ ok: true, status: remote.status.toLowerCase(), order_id: order.id });
    }

    return jsonResponse({
      ok: true,
      status: "pending",
      remote_status: remote.status,
      order_id: order.id,
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
