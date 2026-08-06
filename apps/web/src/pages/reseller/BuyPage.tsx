import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { callFunction, supabase } from '../../lib/supabase'
import { Button, GlassField, Modal, PageHeader } from '../../components/ui'

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

function unitCents(p: Pack) {
  return Math.round(p.amount_cents / Math.max(p.credits, 1))
}

export function ResellerBuyPage() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Pack | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
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
      setPacks((data as Pack[]) || [])
      setLoading(false)
    })()
  }, [])

  const featuredId =
    packs.length >= 2
      ? packs[Math.floor((packs.length - 1) / 2)]?.id
      : packs[0]?.id

  const pollStatus = useCallback(async (orderId: string) => {
    setPolling(true)
    try {
      const res = await callFunction<{ ok: boolean; status: string }>(
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
      if (!cancelled && !done) window.setTimeout(tick, 4000)
    }
    const t = window.setTimeout(tick, 3000)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [checkout, paid, pollStatus])

  function openPack(pack: Pack) {
    setSelected(pack)
    setCheckout(null)
    setPaid(false)
    setCopied(false)
    setError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    if (paid) {
      setCheckout(null)
      setPaid(false)
      setSelected(null)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    setCheckout(null)
    setPaid(false)
    setCopied(false)
    try {
      const res = await callFunction<CheckoutResult>(
        'reseller-create-checkout',
        {
          pack_id: selected.id,
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

  return (
    <div>
      <PageHeader
        title="Comprar tokens"
        description="Escolha um pacote. O PIX abre no modal — QR e copia-e-cola na hora."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="neon-spinner" />
        </div>
      ) : packs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pacote disponível no momento.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => {
            const featured = pack.id === featuredId
            const unit = unitCents(pack)
            return (
              <article
                key={pack.id}
                className={`relative flex flex-col items-center rounded-2xl border bg-surface/90 p-6 text-center transition ${
                  featured
                    ? 'border-brand-orange/70 shadow-[0_0_28px_rgba(255,138,26,0.22)]'
                    : 'border-border hover:border-brand-pink/40'
                }`}
              >
                {featured ? (
                  <span className="absolute -top-3 rounded-full bg-brand-orange px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-black shadow-[0_0_16px_rgba(255,138,26,0.5)]">
                    Mais vendido
                  </span>
                ) : null}

                <span className="mb-2 text-2xl" aria-hidden>
                  ◆
                </span>
                <p
                  className={`text-5xl font-extrabold leading-none tracking-tight ${
                    featured ? 'text-brand-orange' : 'text-brand-pink'
                  }`}
                >
                  {pack.credits}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pack.credits === 1 ? 'token' : 'tokens'}
                </p>
                <p className="mt-1 text-xs font-medium text-white/70">{pack.name}</p>

                <div
                  className={`mt-5 w-full rounded-xl px-3 py-3 ${
                    featured
                      ? 'bg-brand-orange/15 ring-1 ring-brand-orange/30'
                      : 'bg-brand-pink/10 ring-1 ring-brand-pink/20'
                  }`}
                >
                  <p
                    className={`text-xl font-bold ${
                      featured ? 'text-brand-orange' : 'text-brand-pink'
                    }`}
                  >
                    {formatBRL(pack.amount_cents)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    total por {pack.credits} {pack.credits === 1 ? 'token' : 'tokens'}
                  </p>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  {formatBRL(unit)} por token
                </p>

                <Button
                  variant={featured ? 'gradient' : 'ghost'}
                  className={`mt-5 w-full ${
                    featured
                      ? ''
                      : 'border border-white/20 hover:border-brand-pink/50 hover:bg-white/5'
                  }`}
                  onClick={() => openPack(pack)}
                >
                  {featured ? 'Comprar agora' : 'Comprar'}
                </Button>
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          paid
            ? 'Pagamento confirmado'
            : checkout
              ? 'PIX gerado'
              : selected
                ? `Comprar — ${selected.name}`
                : 'Checkout'
        }
      >
        {!selected ? null : paid && checkout ? (
          <div className="space-y-4 text-center">
            <p className="text-lg font-bold text-emerald-400">Tudo certo!</p>
            <p className="text-sm text-muted-foreground">
              +{checkout.credits} tokens creditados na sua conta.
            </p>
            <Button variant="gradient" className="w-full" onClick={closeModal}>
              Fechar
            </Button>
          </div>
        ) : checkout ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Valor:{' '}
              <span className="font-semibold text-white">{formatBRL(checkout.amount_cents)}</span>
              {' · '}
              {checkout.credits} tokens
            </p>
            {checkout.qr_code_base64 ? (
              <img
                src={
                  checkout.qr_code_base64.startsWith('data:')
                    ? checkout.qr_code_base64
                    : `data:image/png;base64,${checkout.qr_code_base64}`
                }
                alt="QR Code PIX"
                className="mx-auto h-52 w-52 rounded-xl bg-white p-2"
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
              Aguardando confirmação…
            </p>
            <Button variant="ghost" className="w-full" onClick={() => pollStatus(checkout.order_id)}>
              Já paguei — verificar
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setCheckout(null)
                setPaid(false)
              }}
            >
              Voltar aos dados
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="rounded-xl border border-border bg-background/50 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Pacote</span>
                <span className="font-semibold text-white">
                  {selected.credits} tokens · {formatBRL(selected.amount_cents)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatBRL(unitCents(selected))} por token
              </p>
            </div>
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
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <Button type="submit" variant="gradient" className="w-full" loading={busy}>
              Comprar via PIX
            </Button>
          </form>
        )}
      </Modal>
    </div>
  )
}
