export type PricingSettings = {
  custom_enabled: boolean;
  min_qty: number;
  max_qty: number;
  unit_price_cents: number;
  subtitle?: string | null;
};

export type PricingTier = {
  id?: string;
  min_qty: number;
  max_qty: number | null;
  discount_bps: number;
  active?: boolean;
};

export type PriceQuote = {
  credits: number;
  unit_price_cents: number;
  amount_cents: number;
  base_unit_price_cents: number;
  discount_bps: number;
  tier_min_qty: number | null;
};

/** Pure pricing — safe for Edge and mirrored in the web preview. */
export function quoteCustomCredits(
  credits: number,
  settings: PricingSettings,
  tiers: PricingTier[],
): PriceQuote {
  const qty = Math.floor(Number(credits) || 0);
  if (!settings.custom_enabled) {
    throw new Error("Quantidade personalizada desativada.");
  }
  if (qty < settings.min_qty || qty > settings.max_qty) {
    throw new Error(`Quantidade deve ser entre ${settings.min_qty} e ${settings.max_qty}.`);
  }

  const active = (tiers || []).filter((t) => t.active !== false);
  const matching = active
    .filter((t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty))
    .sort((a, b) => b.min_qty - a.min_qty || b.discount_bps - a.discount_bps);

  const tier = matching[0] || null;
  const discountBps = Math.min(Math.max(tier?.discount_bps || 0, 0), 10000);
  const base = Math.max(1, Math.floor(settings.unit_price_cents));
  const unit = Math.max(1, Math.floor((base * (10000 - discountBps)) / 10000));
  const amount = unit * qty;

  return {
    credits: qty,
    unit_price_cents: unit,
    amount_cents: amount,
    base_unit_price_cents: base,
    discount_bps: discountBps,
    tier_min_qty: tier?.min_qty ?? null,
  };
}
