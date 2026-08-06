import { handleOptions, jsonResponse, adminClient } from "../_shared/cors.ts";

function generateKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () =>
    Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `INLO-${part()}-${part()}-${part()}`;
}

async function hmacSha1Hex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function authorize(req: Request, rawBody: string): Promise<boolean> {
  const token = Deno.env.get("KIWIFY_WEBHOOK_SECRET") || "";
  if (!token) return false;

  const url = new URL(req.url);
  const signature = (url.searchParams.get("signature") || req.headers.get("x-kiwify-signature") || "")
    .trim()
    .toLowerCase();
  const providedSecret = (
    url.searchParams.get("secret") ||
    req.headers.get("x-kiwify-secret") ||
    req.headers.get("x-webhook-secret") ||
    ""
  ).trim();

  // 1) Token na URL/header (como a Kiwify costuma configurar)
  if (providedSecret && timingSafeEqual(providedSecret, token)) return true;

  // 2) signature HMAC-SHA1(body) ou sha1(order_id+token)
  if (signature) {
    const hmacBody = await hmacSha1Hex(rawBody, token);
    if (timingSafeEqual(hmacBody, signature)) return true;

    try {
      const parsed = JSON.parse(rawBody) as Record<string, unknown>;
      const orderId = String(parsed.order_id || (parsed as { order?: { order_id?: string } }).order?.order_id || "");
      if (orderId) {
        const plain = await sha1Hex(orderId + token);
        if (timingSafeEqual(plain, signature)) return true;
        const hmacOrder = await hmacSha1Hex(orderId, token);
        if (timingSafeEqual(hmacOrder, signature)) return true;
      }
    } catch {
      /* ignore */
    }
  }

  return false;
}

async function sha1Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractEvent(body: Record<string, unknown>) {
  const order = (body.order || body.data || body) as Record<string, unknown>;
  const customer = (order.Customer || order.customer || body.Customer || {}) as Record<string, unknown>;
  const product = (order.Product || order.product || body.Product || {}) as Record<string, unknown>;
  const subscription = (order.Subscription || order.subscription || body.Subscription || {}) as Record<
    string,
    unknown
  >;

  const eventType = String(
    body.webhook_event_type || body.event || body.type || order.order_status || "",
  ).toLowerCase();

  const eventId = String(
    body.order_id ||
      order.order_id ||
      body.id ||
      order.id ||
      `${eventType}-${customer.email || ""}-${Date.now()}`,
  );

  const email = String(customer.email || body.email || "").trim().toLowerCase();
  const fullName =
    String(
      customer.full_name ||
        customer.name ||
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        "",
    ).trim() || null;

  const productId = String(product.product_id || product.id || body.product_id || "");
  const kiwifySubscriptionId = String(
    subscription.id || body.subscription_id || order.subscription_id || "",
  ) || null;

  return { eventType, eventId, email, fullName, productId, kiwifySubscriptionId, subscription };
}

type Action =
  | "provision"
  | "renew"
  | "late"
  | "cancel"
  | "ignore";

function classify(eventType: string): Action {
  if (
    [
      "order_refunded",
      "refund",
      "reembolso",
      "chargeback",
      "chargedback",
      "subscription_canceled",
      "subscription_cancelled",
      "cancelada",
      "compra_reembolsada",
      "compra_refunded",
    ].some((t) => eventType.includes(t))
  ) {
    return "cancel";
  }
  if (eventType.includes("late") || eventType.includes("atrasad")) return "late";
  if (eventType.includes("renew") || eventType.includes("renov")) return "renew";
  if (
    [
      "order_approved",
      "compra_aprovada",
      "approved",
      "paid",
      "subscription_created",
    ].some((t) => eventType.includes(t)) ||
    eventType === "paid"
  ) {
    return "provision";
  }
  return "ignore";
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const token = Deno.env.get("KIWIFY_WEBHOOK_SECRET") || "";
  if (!token) {
    return jsonResponse({ ok: false, error: "KIWIFY_WEBHOOK_SECRET não configurado." }, 503);
  }

  const rawBody = await req.text();
  if (!(await authorize(req, rawBody))) {
    return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, error: "JSON inválido" }, 400);
  }

  const sb = adminClient();
  const { eventType, eventId, email, fullName, productId, kiwifySubscriptionId } = extractEvent(body);
  const action = classify(eventType);

  const { data: existing } = await sb
    .from("webhook_events")
    .select("id, processed_at")
    .eq("provider", "kiwify")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing?.processed_at) {
    return jsonResponse({ ok: true, duplicate: true, event_id: eventId });
  }

  const { data: eventRow, error: evErr } = await sb
    .from("webhook_events")
    .upsert(
      {
        provider: "kiwify",
        event_id: eventId,
        event_type: eventType || "unknown",
        payload: body,
      },
      { onConflict: "provider,event_id" },
    )
    .select("id")
    .single();

  if (evErr) return jsonResponse({ ok: false, error: evErr.message }, 500);

  try {
    if (action === "ignore") {
      await sb.from("webhook_events").update({
        processed_at: new Date().toISOString(),
        error: `ignored:${eventType}`,
      }).eq("id", eventRow.id);
      return jsonResponse({ ok: true, action: "ignored", event_type: eventType });
    }

    if (!email) throw new Error("E-mail do comprador ausente no payload.");

    let plan: { id: string; code: string; duration_days: number } | null = null;
    if (productId) {
      const { data: byProduct } = await sb
        .from("plans")
        .select("*")
        .eq("active", true)
        .eq("kiwify_product_id", productId)
        .maybeSingle();
      plan = byProduct;
    }
    if (!plan) {
      const { data: fallback } = await sb
        .from("plans")
        .select("*")
        .eq("code", "plan_1")
        .eq("active", true)
        .maybeSingle();
      plan = fallback;
    }

    const durationDays = plan?.duration_days || 30;
    const planId = plan?.id || null;

    let userId: string | null = null;
    const { data: profile } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();

    if (profile?.id) {
      userId = profile.id;
      if (fullName) {
        await sb.from("profiles").update({ full_name: fullName }).eq("id", userId);
      }
    } else {
      const { data: created, error: createErr } = await sb.auth.admin.createUser({
        email,
        email_confirm: true,
        app_metadata: { role: "member", source: "kiwify" },
        user_metadata: { full_name: fullName },
      });
      if (createErr || !created.user) throw new Error(createErr?.message || "Falha ao criar usuário");
      userId = created.user.id;
      await sb.from("profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
        role: "member",
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 86400000);

    if (action === "cancel") {
      await sb
        .from("subscriptions")
        .update({ status: "canceled", updated_at: now.toISOString() })
        .eq("user_id", userId!)
        .in("status", ["active", "past_due"]);

      await sb
        .from("licenses")
        .update({ status: "revoked", revoked: true, updated_at: now.toISOString() })
        .eq("user_id", userId!)
        .eq("source", "kiwify")
        .eq("status", "active");

      await sb.from("webhook_events").update({
        processed_at: now.toISOString(),
        error: null,
      }).eq("id", eventRow.id);

      return jsonResponse({ ok: true, action: "revoked", user_id: userId, event_id: eventId });
    }

    // Find existing subscription (by kiwify sub id, order id, or user)
    let subQuery = sb.from("subscriptions").select("id, expires_at, status").eq("user_id", userId!);
    const { data: subs } = await subQuery.order("created_at", { ascending: false }).limit(5);
    let sub = (subs || []).find((s) => s.status === "active" || s.status === "past_due") ||
      (subs || [])[0] ||
      null;

    if (kiwifySubscriptionId) {
      const { data: bySub } = await sb
        .from("subscriptions")
        .select("id, expires_at, status")
        .eq("kiwify_subscription_id", kiwifySubscriptionId)
        .maybeSingle();
      if (bySub) sub = bySub;
    }

    if (action === "late") {
      if (sub?.id) {
        await sb.from("subscriptions").update({
          status: "past_due",
          raw_last_event_id: eventId,
          updated_at: now.toISOString(),
        }).eq("id", sub.id);
      }
      await sb.from("webhook_events").update({
        processed_at: now.toISOString(),
        error: null,
      }).eq("id", eventRow.id);
      return jsonResponse({ ok: true, action: "late", user_id: userId, event_id: eventId });
    }

    // provision | renew
    if (sub?.id) {
      const base = action === "renew"
        ? new Date(Math.max(now.getTime(), new Date(sub.expires_at || now).getTime()))
        : now;
      const newExp = new Date(base.getTime() + durationDays * 86400000);
      await sb.from("subscriptions").update({
        status: "active",
        plan_id: planId,
        expires_at: newExp.toISOString(),
        kiwify_order_id: eventId,
        kiwify_subscription_id: kiwifySubscriptionId,
        raw_last_event_id: eventId,
        updated_at: now.toISOString(),
      }).eq("id", sub.id);

      const { data: existingLic } = await sb
        .from("licenses")
        .select("key")
        .eq("user_id", userId!)
        .eq("source", "kiwify")
        .in("status", ["active", "expired"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingLic?.key) {
        await sb.from("licenses").update({
          status: "active",
          revoked: false,
          expires_at: newExp.toISOString(),
          updated_at: now.toISOString(),
        }).eq("key", existingLic.key);
      } else {
        await sb.from("licenses").insert({
          key: generateKey(),
          plan: plan?.code || "plan_1",
          plan_id: planId,
          status: "active",
          duration_days: durationDays,
          activated_at: now.toISOString(),
          expires_at: newExp.toISOString(),
          user_id: userId!,
          bound_email: email,
          source: "kiwify",
          revoked: false,
        });
      }
    } else {
      await sb.from("subscriptions").insert({
        user_id: userId!,
        plan_id: planId,
        status: "active",
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        kiwify_order_id: eventId,
        kiwify_subscription_id: kiwifySubscriptionId,
        raw_last_event_id: eventId,
      });

      await sb.from("licenses").insert({
        key: generateKey(),
        plan: plan?.code || "plan_1",
        plan_id: planId,
        status: "active",
        duration_days: durationDays,
        activated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        user_id: userId!,
        bound_email: email,
        source: "kiwify",
        revoked: false,
      });
    }

    // Magic link best-effort (precisa SMTP configurado para e-mail real)
    try {
      await sb.auth.admin.generateLink({ type: "magiclink", email });
    } catch {
      /* ignore */
    }

    await sb.from("webhook_events").update({
      processed_at: now.toISOString(),
      error: null,
    }).eq("id", eventRow.id);

    return jsonResponse({
      ok: true,
      action: sub?.id ? (action === "renew" ? "renewed" : "updated") : "provisioned",
      user_id: userId,
      event_id: eventId,
      email,
    });
  } catch (e) {
    await sb.from("webhook_events").update({
      error: String(e),
    }).eq("id", eventRow.id);
    return jsonResponse({ ok: false, error: String(e) }, 500);
  }
});
