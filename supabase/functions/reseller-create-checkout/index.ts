import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { createPixSale, webhookUrl } from "../_shared/blackcat.ts";

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const gate = await requireUser(req);
  if ("error" in gate) return gate;
  const { user, role, sb } = gate;

  const isReseller = role === "reseller";
  const isAdmin = role === "super_admin" || role === "admin";
  if (!isReseller && !isAdmin) {
    return jsonResponse({ ok: false, error: "Forbidden" }, 403);
  }

  try {
    const body = await req.json();
    const packId = String(body.pack_id || "").trim();
    const name = String(body.customer?.name || body.name || "").trim();
    const phone = onlyDigits(String(body.customer?.phone || body.phone || ""));
    const docType = String(body.customer?.document?.type || body.document_type || "cpf").toLowerCase();
    const docNumber = onlyDigits(String(body.customer?.document?.number || body.document || ""));

    if (!packId) return jsonResponse({ ok: false, error: "pack_id obrigatório." }, 400);
    if (!name || phone.length < 10 || docNumber.length < 11) {
      return jsonResponse({ ok: false, error: "Informe nome, telefone e CPF." }, 400);
    }

    const { data: pack, error: packErr } = await sb
      .from("credit_packs")
      .select("*")
      .eq("id", packId)
      .eq("active", true)
      .maybeSingle();
    if (packErr) return jsonResponse({ ok: false, error: packErr.message }, 500);
    if (!pack) return jsonResponse({ ok: false, error: "Pack inválido ou inativo." }, 404);

    const { data: profile } = await sb.from("profiles").select("email").eq("id", user.id).maybeSingle();
    const email = (profile?.email || user.email || "").toLowerCase();
    if (!email) return jsonResponse({ ok: false, error: "E-mail do perfil ausente." }, 400);

    if (isReseller) {
      const { data: reseller } = await sb
        .from("resellers")
        .select("id, active")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!reseller) {
        const { error: insErr } = await sb.from("resellers").insert({
          user_id: user.id,
          credits_remaining: 0,
          credits_lifetime: 0,
          active: true,
          notes: "auto:checkout",
        });
        if (insErr) return jsonResponse({ ok: false, error: insErr.message }, 500);
      } else if (!reseller.active) {
        return jsonResponse({ ok: false, error: "Revendedor inativo." }, 403);
      }
    }

    const externalRef = `il-credits-${crypto.randomUUID()}`;
    const customer = {
      name,
      email,
      phone,
      document: {
        type: (docType === "cnpj" ? "cnpj" : "cpf") as "cpf" | "cnpj",
        number: docNumber,
      },
    };

    const { data: order, error: orderErr } = await sb
      .from("credit_orders")
      .insert({
        reseller_user_id: user.id,
        pack_id: pack.id,
        credits: pack.credits,
        amount_cents: pack.amount_cents,
        provider: "blackcat",
        external_ref: externalRef,
        status: "pending",
        customer_snapshot: customer,
      })
      .select("*")
      .single();
    if (orderErr || !order) {
      return jsonResponse({ ok: false, error: orderErr?.message || "Falha ao criar pedido." }, 500);
    }

    const sale = await createPixSale({
      amountCents: pack.amount_cents,
      title: `${pack.name} (${pack.credits} créditos InfinityLov)`,
      customer,
      externalRef,
      postbackUrl: webhookUrl(),
      expiresInDays: 1,
    });

    await sb
      .from("credit_orders")
      .update({
        provider_transaction_id: sale.transactionId,
        pix_copy_paste: sale.copyPaste || sale.qrCode || null,
        pix_qr_base64: sale.qrCodeBase64 || null,
        raw_create: sale.raw,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    return jsonResponse({
      ok: true,
      order_id: order.id,
      transaction_id: sale.transactionId,
      status: "pending",
      credits: pack.credits,
      amount_cents: pack.amount_cents,
      copy_paste: sale.copyPaste || sale.qrCode || null,
      qr_code_base64: sale.qrCodeBase64 || null,
      expires_at: sale.expiresAt || null,
    });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
