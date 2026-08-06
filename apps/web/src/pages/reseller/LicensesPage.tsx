import { useCallback, useEffect, useState } from 'react'
import { callFunction, supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Button, GlassField, Modal, PageHeader, StatusPill } from '../../components/ui'

type License = {
  key: string
  status: string
  duration_days: number | null
  created_at: string
  expires_at: string | null
}

function buildBatchMessage(keys: string[], days: number) {
  return [
    'InfinityLov — lote revenda',
    `Quantidade: ${keys.length} | Dias: ${days}`,
    '',
    ...keys.map((k, i) => `${i + 1}. ${k}`),
  ].join('\n')
}

export function ResellerLicensesPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<License[]>([])
  const [credits, setCredits] = useState(0)
  const [resellerId, setResellerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [qty, setQty] = useState(5)
  const [days, setDays] = useState(30)
  const [keys, setKeys] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: reseller } = await supabase
      .from('resellers')
      .select('id, credits_remaining')
      .eq('user_id', user.id)
      .maybeSingle()
    setCredits(reseller?.credits_remaining ?? 0)
    setResellerId(reseller?.id ?? null)

    let q = supabase
      .from('licenses')
      .select('key, status, duration_days, created_at, expires_at, reseller_id')
      .order('created_at', { ascending: false })
      .limit(300)

    if (reseller?.id) q = q.eq('reseller_id', reseller.id)
    else q = q.eq('source', 'reseller')

    if (filter !== 'all') q = q.eq('status', filter)

    const { data: licenses } = await q
    setRows((licenses as License[]) || [])
    setLoading(false)
  }, [user, filter])

  useEffect(() => {
    load()
  }, [load])

  async function generate() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await callFunction<{ ok: boolean; keys: string[]; quantity: number }>(
        'reseller-generate-licenses',
        { quantity: qty, duration_days: days, label: 'reseller-ui' },
        { auth: true },
      )
      setKeys(res.keys || [])
      setStep(2)
      setCopied(false)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao gerar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Licenças"
        description={`Saldo: ${credits} crédito${credits === 1 ? '' : 's'}. 1 crédito = 1 chave.`}
        actions={
          <Button
            variant="gradient"
            disabled={!resellerId || credits < 1}
            onClick={() => {
              setStep(1)
              setKeys([])
              setQty(Math.min(5, Math.max(credits, 1)))
              setModalOpen(true)
            }}
          >
            Gerar lote
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {['all', 'unused', 'active', 'revoked', 'expired'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              filter === s ? 'gradient-brand text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            {s === 'all' ? 'todas' : s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Chave</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Dias</th>
              <th className="px-3 py-3">Criada</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <span className="neon-spinner inline-block" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-muted-foreground">
                  Nenhuma licença ainda. Compre créditos e gere um lote.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="px-3 py-2.5 font-mono text-xs text-white">{r.key}</td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.duration_days ?? '—'}</td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      className="!py-1 text-xs"
                      onClick={async () => {
                        await navigator.clipboard.writeText(r.key)
                      }}
                    >
                      Copiar
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={step === 1 ? 'Gerar lote' : 'Lote gerado'}
      >
        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Saldo: {credits} créditos</p>
            <label className="block space-y-1.5">
              <span className="text-xs uppercase text-muted-foreground">Quantidade</span>
              <GlassField
                type="number"
                min={1}
                max={Math.max(credits, 1)}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs uppercase text-muted-foreground">Dias de validade</span>
              <GlassField
                type="number"
                min={1}
                max={3650}
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 30)}
              />
            </label>
            {msg ? <p className="text-sm text-red-400">{msg}</p> : null}
            <Button variant="gradient" className="w-full" loading={busy} onClick={generate}>
              Gerar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <pre className="scrollbar-brand max-h-64 overflow-auto rounded-xl border border-border bg-background/80 p-3 font-mono text-xs whitespace-pre-wrap">
              {buildBatchMessage(keys, days)}
            </pre>
            <Button
              variant="gradient"
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(buildBatchMessage(keys, days))
                setCopied(true)
              }}
            >
              {copied ? 'Copiado!' : 'Copiar tudo'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setModalOpen(false)}>
              Fechar
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
