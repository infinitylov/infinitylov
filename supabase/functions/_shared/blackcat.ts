/** BlackCat Pay API helpers — secret key only on Edge Functions */
const BLACKCAT_BASE = "https://api.blackcatoficial.com/api";

export function blackcatSecret(): string {
  const key = Deno.env.get("BLACKCAT_SECRET_KEY") || "";
  if (!key) throw new Error("BLACKCAT_SECRET_KEY não configurada.");
  return key;
}

export type BlackCatCustomer = {
  name: string;
  email: string;
  phone: string;
  document: { type: "cpf" | "cnpj"; number: string };
};

export type CreatePixSaleInput = {
  amountCents: number;
  title: string;
  customer: BlackCatCustomer;
  externalRef: string;
  postbackUrl: string;
  expiresInDays?: number;
};

export type CreatePixSaleResult = {
  transactionId: string;
  status: string;
  amount: number;
  invoiceUrl?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  copyPaste?: string;
  expiresAt?: string;
  raw: unknown;
};

export async function createPixSale(input: CreatePixSaleInput): Promise<CreatePixSaleResult> {
  const apiKey = blackcatSecret();
  const body = {
    amount: input.amountCents,
    currency: "BRL",
    paymentMethod: "pix",
    items: [
      {
        title: input.title,
        quantity: 1,
        tangible: false,
      },
    ],
    customer: input.customer,
    pix: { expiresInDays: input.expiresInDays ?? 1 },
    postbackUrl: input.postbackUrl,
    externalRef: input.externalRef,
    metadata: `infinitylov-credits:${input.externalRef}`,
  };

  const res = await fetch(`${BLACKCAT_BASE}/sales/create-sale`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || `BlackCat create-sale ${res.status}`);
  }

  const data = json.data || json;
  const payment = data.paymentData || {};
  return {
    transactionId: String(data.transactionId),
    status: String(data.status || "PENDING"),
    amount: Number(data.amount),
    invoiceUrl: data.invoiceUrl,
    qrCode: payment.qrCode,
    qrCodeBase64: payment.qrCodeBase64,
    copyPaste: payment.copyPaste,
    expiresAt: payment.expiresAt,
    raw: json,
  };
}

export async function getSaleStatus(transactionId: string): Promise<{
  status: string;
  amount?: number;
  paidAt?: string;
  raw: unknown;
}> {
  const apiKey = blackcatSecret();
  const res = await fetch(`${BLACKCAT_BASE}/sales/${encodeURIComponent(transactionId)}/status`, {
    headers: { "X-API-Key": apiKey },
  });
  const json = await res.json();
  if (!res.ok || json?.success === false) {
    throw new Error(json?.error || json?.message || `BlackCat status ${res.status}`);
  }
  const data = json.data || json;
  return {
    status: String(data.status || "").toUpperCase(),
    amount: data.amount != null ? Number(data.amount) : undefined,
    paidAt: data.paidAt,
    raw: json,
  };
}

export function webhookUrl(): string {
  const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
  return `${base}/functions/v1/blackcat-webhook`;
}
