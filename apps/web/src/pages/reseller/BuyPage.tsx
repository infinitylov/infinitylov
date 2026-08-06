import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { callFunction, supabase } from '../../lib/supabase'
import { Button, GlassField, PageHeader } from '../../components/ui'

type Pack = {
  id: string
  name: string
  credits: number
  amount_cents: number
}

type CheckoutResult = {
  ok: boolean
  order_id: string
  credits: number
  amount_cents: number
  copy_paste: string | null
  qr_code_base64: string | null
  status: string
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ResellerBuyPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [packId, setPackId] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [document, setDocument] = useState('')
  const [busy, setBusy] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<CheckoutResult | null>(null)
  const [paid, setPaid] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('credit_packs')
        .select('id, name, credits, amount_cents')
        .eq('active', true)
        .order('sort_order', { ascending: true })
      const list = (data as Pack[]) || []
      setPacks(list)
      if (list[0]) setPackId(list[0].id)
    })()
  }, [])

  const pollStatus = useCallback(async (orderId: string) => {
    setPolling(true)
    try {
      const res = await callFunction<{ ok: boolean; status: string; credited?: boolean }>(
        'reseller-order-status',
        { order_id: orderId },
        { auth: true },
      )
      if (res.status === 'paid') {
        setPaid(true)
        setPolling(false)
        return true
      }
    } catch {
      /* keep polling */
    }
    return false
  }, [])

  useEffect(() => {
    if (!checkout?.order_id || paid) return
    let cancelled = false
    const tick = async () => {
      const done = await pollStatus(checkout.order_id)
      if (!cancelled && !done) {
        window.setTimeout(tick, 4000)
      }
    }
    const t = window.setTimeout(tick, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [checkout, paid, pollStatus])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setCheckout(null)
    setPaid(false)
    setCopied(false)
    try {
      const res = await callFunction<CheckoutResult>(
        'reseller-create-checkout',
        {
          pack_id: packId,
          customer: {
            name: name.trim(),
            phone,
            document: { type: 'cpf', number: document },
          },
        },
        { auth: true },
      )
      setCheckout(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no checkout')
    } finally {
      setBusy(false)
    }
  }

  const selected = packs.find((p) => p.id === packId)

  return (
    <div>
      <PageHeader
        title="Comprar tokens"
        description="Pagamento PIX transparente — QR e copia-e-cola na tela. Após o pagamento, os tokens caem no saldo."
      />

      {!checkout ? (
        <form
          onSubmit={onSubmit}
          className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-5"
        >
          <label className="block space-y-1.5">
            <span className="text-xs uppercase text-muted-foreground">Pacote</span>
            <select
              className="w-full rounded-xl border border-border bg-background/80 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-pink"
              value={packId}
              onChange={(e) => setPackId(e.target.value)}
              required
            >
              {packs.length === 0 ? <option value="">Nenhum pack ativo</option> : null}
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.credits} créditos — {formatBRL(p.amount_cents)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase text-muted-foreground">Nome completo</span>
            <GlassField value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase text-muted-foreground">Telefone</span>
            <GlassField
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs uppercase text-muted-foreground">CPF</span>
            <GlassField
              value={document}
              onChange={(e) => setDocument(e.target.value)}
              placeholder="00000000000"
              required
            />
          </label>
          {selected ? (
            <p className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-white">{formatBRL(selected.amount_cents)}</span>
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <Button type="submit" variant="gradient" className="w-full" loading={busy} disabled={!packId}>
            Gerar PIX
          </Button>
        </form>
      ) : (
        <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-border bg-surface p-5 text-center">
          {paid ? (
            <>
              <p className="text-lg font-bold text-emerald-400">Pagamento confirmado!</p>
              <p className="text-sm text-muted-foreground">
                +{checkout.credits} tokens creditados na sua conta.
              </p>
              <Button
                variant="gradient"
                onClick={() => {
                  setCheckout(null)
                  setPaid(false)
                }}
              >
                Nova compra
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Escaneie o QR ou copie o código PIX. Valor:{' '}
                <span className="font-semibold text-white">{formatBRL(checkout.amount_cents)}</span>
              </p>
              {checkout.qr_code_base64 ? (
                <img
                  src={
                    checkout.qr_code_base64.startsWith('data:')
                      ? checkout.qr_code_base64
                      : `data:image/png;base64,${checkout.qr_code_base64}`
                  }
                  alt="QR Code PIX"
                  className="mx-auto h-56 w-56 rounded-xl bg-white p-2"
                />
              ) : (
                <p className="text-xs text-muted-foreground">QR indisponível — use o copia-e-cola.</p>
              )}
              {checkout.copy_paste ? (
                <div className="space-y-2">
                  <pre className="scrollbar-brand max-h-24 overflow-auto rounded-xl border border-border bg-background/80 p-3 text-left font-mono text-[10px] break-all whitespace-pre-wrap">
                    {checkout.copy_paste}
                  </pre>
                  <Button
                    variant="gradient"
                    className="w-full"
                    onClick={async () => {
                      await navigator.clipboard.writeText(checkout.copy_paste || '')
                      setCopied(true)
                    }}
                  >
                    {copied ? 'Copiado!' : 'Copiar PIX'}
                  </Button>
                </div>
              ) : null}
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                {polling ? <span className="neon-spinner !h-4 !w-4" /> : null}
                Aguardando confirmação do pagamento…
              </p>
              <Button variant="ghost" onClick={() => pollStatus(checkout.order_id)}>
                Já paguei — verificar
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setCheckout(null)
                  setPaid(false)
                }}
              >
                Cancelar / novo
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
