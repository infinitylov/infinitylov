import { handleOptions, jsonResponse, adminClient } from "../_shared/cors.ts";
import { getSaleStatus } from "../_shared/blackcat.ts";

type OrderRow = {
  id: string;
  reseller_user_id: string;
  credits: number;
  amount_cents: number;
  status: string;
  provider_transaction_id: string | null;
  external_ref: string;
};

async function creditReseller(sb: ReturnType<typeof adminClient>, userId: string, credits: number) {
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
      notes: "auto:blackcat",
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

async function markPaid(
  sb: ReturnType<typeof adminClient>,
  order: OrderRow,
  raw: unknown,
) {
  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from("credit_orders")
    .update({
      status: "paid",
      paid_at: now,
      raw_webhook: raw,
      updated_at: now,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!updated) return { credited: false, reason: "already_processed" };

  await creditReseller(sb, order.reseller_user_id, order.credits);
  return { credited: true };
}

async function findOrder(
  sb: ReturnType<typeof adminClient>,
  transactionId?: string | null,
  externalRef?: string | null,
): Promise<OrderRow | null> {
  if (transactionId) {
    const { data } = await sb
      .from("credit_orders")
      .select("id, reseller_user_id, credits, amount_cents, status, provider_transaction_id, external_ref")
      .eq("provider_transaction_id", transactionId)
      .maybeSingle();
    if (data) return data as OrderRow;
  }
  if (externalRef) {
    const { data } = await sb
      .from("credit_orders")
      .select("id, reseller_user_id, credits, amount_cents, status, provider_transaction_id, external_ref")
      .eq("external_ref", externalRef)
      .maybeSingle();
    if (data) return data as OrderRow;
  }
  return null;
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const sb = adminClient();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "JSON inválido" }, 400);
  }

  const headerEvent = (req.headers.get("X-Webhook-Event") || "").toLowerCase();
  const event = String(body.event || headerEvent || "").toLowerCase();
  const transactionId = String(body.transactionId || body.transaction_id || "").trim() || null;
  const externalRef = String(body.externalReference || body.externalRef || body.external_ref || "").trim() ||
    null;
  const status = String(body.status || "").toUpperCase();

  try {
    if (event.includes("withdrawal")) {
      return jsonResponse({ ok: true, ignored: true, event });
    }

    const order = await findOrder(sb, transactionId, externalRef);
    if (!order) {
      return jsonResponse({ ok: true, ignored: true, reason: "order_not_found", event, transactionId });
    }

    if (event.includes("transaction.created") || (event.includes("created") && status === "PENDING")) {
      await sb
        .from("credit_orders")
        .update({
          raw_webhook: body,
          provider_transaction_id: transactionId || order.provider_transaction_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      return jsonResponse({ ok: true, action: "created", order_id: order.id });
    }

    if (
      event.includes("transaction.failed") ||
      status === "CANCELLED" ||
      status === "FAILED" ||
      status === "EXPIRED"
    ) {
      await sb
        .from("credit_orders")
        .update({
          status: status === "EXPIRED" ? "expired" : "cancelled",
          raw_webhook: body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending");
      return jsonResponse({ ok: true, action: "cancelled", order_id: order.id });
    }

    if (event.includes("transaction.paid") || status === "PAID") {
      const txId = transactionId || order.provider_transaction_id;
      if (!txId) return jsonResponse({ ok: false, error: "transactionId ausente" }, 400);

      // Confirm with BlackCat API
      const confirmed = await getSaleStatus(txId);
      if (confirmed.status !== "PAID") {
        return jsonResponse({
          ok: true,
          action: "skipped",
          reason: "status_not_paid",
          remote_status: confirmed.status,
        });
      }
      if (confirmed.amount != null && confirmed.amount !== order.amount_cents) {
        return jsonResponse({
          ok: false,
          error: "amount_mismatch",
          expected: order.amount_cents,
          got: confirmed.amount,
        }, 400);
      }

      const result = await markPaid(sb, order, { webhook: body, status: confirmed.raw });
      return jsonResponse({ ok: true, action: "paid", order_id: order.id, ...result });
    }

    await sb
      .from("credit_orders")
      .update({ raw_webhook: body, updated_at: new Date().toISOString() })
      .eq("id", order.id);

    return jsonResponse({ ok: true, ignored: true, event });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
