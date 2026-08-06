import { useCallback, useEffect, useState } from 'react'
import { callFunction, supabase } from '../../lib/supabase'
import { Button, GlassField, IconButton, Modal, PageHeader, StatusPill } from '../../components/ui'

type License = {
  key: string
  status: string
  source: string
  bound_email: string | null
  hwid: string | null
  expires_at: string | null
  duration_days: number | null
  created_at: string
}

function IconReset({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
      <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRevoke({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 8l8 8M16 8l-8 8" strokeLinecap="round" />
    </svg>
  )
}

function buildBatchMessage(keys: string[], days: number) {
  const lines = [
    'InfinityLov — lote gerado',
    `Quantidade: ${keys.length} | Dias: ${days}`,
    '',
    ...keys.map((k, i) => `${i + 1}. ${k}`),
  ]
  return lines.join('\n')
}

export function AdminLicensesPage() {
  const [rows, setRows] = useState<License[]>([])
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [genQty, setGenQty] = useState(5)
  const [genDays, setGenDays] = useState(30)
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase
      .from('licenses')
      .select('key, status, source, bound_email, hwid, expires_at, duration_days, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (status !== 'all') q = q.eq('status', status)
    const { data, error } = await q
    if (!error) setRows((data as License[]) || [])
    setLoading(false)
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  const filtered = rows.filter((r) => {
    const s = filter.toLowerCase()
    if (!s) return true
    return (
      r.key.toLowerCase().includes(s) ||
      (r.bound_email || '').toLowerCase().includes(s) ||
      (r.source || '').toLowerCase().includes(s)
    )
  })

  function openModal() {
    setStep(1)
    setGeneratedKeys([])
    setCopied(false)
    setMsg(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setStep(1)
    setGeneratedKeys([])
    setCopied(false)
  }

  async function resetHwid(key: string) {
    if (!confirm(`Resetar HWID de ${key}?`)) return
    setBusy(true)
    setMsg(null)
    try {
      await callFunction('admin-reset-device', { license_key: key }, { auth: true })
      setMsg(`HWID resetado: ${key}`)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(key: string) {
    if (!confirm(`Revogar ${key}? Esta ação remove o acesso.`)) return
    setBusy(true)
    setMsg(null)
    try {
      await callFunction('admin-revoke-license', { license_key: key }, { auth: true })
      setMsg(`Revogada: ${key}`)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  async function generate() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await callFunction<{ ok: boolean; keys: string[]; quantity: number }>(
        'reseller-generate-licenses',
        { quantity: genQty, duration_days: genDays, label: 'admin-ui' },
        { auth: true },
      )
      setGeneratedKeys(res.keys || [])
      setStep(2)
      setCopied(false)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao gerar')
    } finally {
      setBusy(false)
    }
  }

  async function copyBatch() {
    const text = buildBatchMessage(generatedKeys, genDays)
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setMsg(`Copiado: ${key}`)
  }

  const batchMessage = buildBatchMessage(generatedKeys, genDays)

  return (
    <div>
      <PageHeader
        title="Licenças"
        description="Listar, gerar, resetar dispositivo e revogar."
        actions={
          <Button variant="gradient" onClick={openModal}>
            Gerar lote
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <GlassField
          placeholder="Buscar chave / e-mail…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs !py-2"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground"
        >
          <option value="all">Todos status</option>
          <option value="unused">unused</option>
          <option value="active">active</option>
          <option value="revoked">revoked</option>
          <option value="expired">expired</option>
        </select>
        <Button variant="ghost" onClick={load}>
          Atualizar
        </Button>
      </div>

      {msg ? <p className="mb-3 text-sm text-brand-pink">{msg}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full table-fixed text-left text-sm">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[26%]" />
            <col className="w-[12%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Chave</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3">E-mail</th>
              <th className="px-3 py-3">Expira</th>
              <th className="px-3 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center">
                  <span className="neon-spinner inline-block" />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                  Nenhuma licença
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.key} className="border-t border-border/60 hover:bg-brand-pink/[0.06]">
                  <td className="truncate px-3 py-2.5">
                    <button
                      type="button"
                      className="max-w-full truncate font-mono text-xs text-white hover:text-brand-pink"
                      onClick={() => copyKey(r.key)}
                      title="Copiar"
                    >
                      {r.key}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="truncate px-3 py-2.5 text-muted-foreground">{r.source}</td>
                  <td className="truncate px-3 py-2.5 text-muted-foreground" title={r.bound_email || ''}>
                    {r.bound_email || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                    {r.expires_at ? new Date(r.expires_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Reset HWID"
                        disabled={busy || !r.hwid}
                        onClick={() => resetHwid(r.key)}
                      >
                        <IconReset />
                      </IconButton>
                      <IconButton
                        label="Revogar"
                        variant="danger"
                        disabled={busy || r.status === 'revoked'}
                        onClick={() => revoke(r.key)}
                      >
                        <IconRevoke />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={step === 1 ? 'Gerar lote' : 'Lote gerado'}
      >
        {step === 1 ? (
          <div className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Quantidade
              </span>
              <GlassField
                type="number"
                min={1}
                max={100}
                value={genQty}
                onChange={(e) => setGenQty(Number(e.target.value) || 1)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Dias de validade
              </span>
              <GlassField
                type="number"
                min={1}
                max={3650}
                value={genDays}
                onChange={(e) => setGenDays(Number(e.target.value) || 30)}
              />
            </label>
            {msg ? <p className="text-sm text-red-400">{msg}</p> : null}
            <Button variant="gradient" className="w-full" onClick={generate} loading={busy}>
              Gerar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {generatedKeys.length} chave(s) pronta(s) para copiar.
            </p>
            <pre className="scrollbar-brand max-h-64 overflow-auto rounded-xl border border-border bg-background/80 p-3 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
              {batchMessage}
            </pre>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="gradient" className="flex-1" onClick={copyBatch}>
                {copied ? 'Copiado!' : 'Copiar tudo'}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setStep(1)
                  setGeneratedKeys([])
                  setCopied(false)
                }}
              >
                Novo lote
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={closeModal}>
              Fechar
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
