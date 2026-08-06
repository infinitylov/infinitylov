import { useEffect, useState } from 'react'
import { callFunction } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, GlassField, Modal } from './ui'

type Counts = Record<string, number>

const OPTIONS: { id: string; label: string; hint: string; countKey: string }[] = [
  {
    id: 'licenses',
    label: 'Todas as licenças / tokens',
    hint: 'Apaga licenses + lotes (license_batches)',
    countKey: 'licenses',
  },
  {
    id: 'credit_orders',
    label: 'Pedidos PIX / crédito',
    hint: 'Histórico de credit_orders',
    countKey: 'credit_orders',
  },
  {
    id: 'webhook_events',
    label: 'Eventos de webhook',
    hint: 'Logs Kiwify/BlackCat etc.',
    countKey: 'webhook_events',
  },
  {
    id: 'subscriptions',
    label: 'Subscriptions',
    hint: 'Assinaturas vinculadas',
    countKey: 'subscriptions',
  },
  {
    id: 'resellers',
    label: 'Linhas de revendedores',
    hint: 'Saldo/créditos em resellers (contas Auth permanecem)',
    countKey: 'resellers',
  },
  {
    id: 'lesson_progress',
    label: 'Progresso de aulas',
    hint: 'lesson_progress',
    countKey: 'lesson_progress',
  },
  {
    id: 'users_keep_admins',
    label: 'Usuários (manter só admins)',
    hint: 'Remove members/resellers/support; mantém super_admin e admin',
    countKey: 'users_to_delete',
  },
  {
    id: 'credit_packs',
    label: 'Packs de crédito',
    hint: 'Apaga pacotes da loja (preço personalizado fica)',
    countKey: 'credit_packs',
  },
  {
    id: 'pricing_tiers',
    label: 'Faixas de desconto',
    hint: 'credit_pricing_tiers',
    countKey: 'pricing_tiers',
  },
]

export function AdminPurgeButton() {
  const { isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadPreview() {
    setError(null)
    try {
      const res = await callFunction<{ ok: boolean; counts: Counts }>(
        'admin-purge',
        { action: 'preview' },
        { auth: true },
      )
      setCounts(res.counts || {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar contagens')
    }
  }

  useEffect(() => {
    if (open) {
      setResult(null)
      setConfirm('')
      setSelected({})
      loadPreview()
    }
  }, [open])

  if (!isAdmin) return null

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  function selectAll() {
    const next: Record<string, boolean> = {}
    for (const o of OPTIONS) next[o.id] = true
    setSelected(next)
  }

  async function runPurge() {
    const targets = OPTIONS.filter((o) => selected[o.id]).map((o) => o.id)
    if (!targets.length) {
      setError('Selecione ao menos uma opção.')
      return
    }
    if (confirm.trim().toUpperCase() !== 'APAGAR') {
      setError('Digite APAGAR para confirmar.')
      return
    }
    if (
      !window.confirm(
        `Confirma limpeza irreversível de:\n\n${targets.join('\n')}\n\nIsso não pode ser desfeito.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await callFunction<{ ok: boolean; deleted: Record<string, unknown> }>(
        'admin-purge',
        { action: 'purge', targets, confirm: 'APAGAR' },
        { auth: true },
      )
      setResult(JSON.stringify(res.deleted, null, 2))
      await loadPreview()
      setConfirm('')
      setSelected({})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na limpeza')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="ghost" className="border border-red-500/40 text-red-300 hover:bg-red-500/10" onClick={() => setOpen(true)}>
        Limpar dados
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Limpeza de dados">
        <div className="space-y-4">
          <p className="text-sm text-red-300">
            Ação destrutiva. Escolha o que apagar. Admins (super_admin/admin) nunca são removidos.
          </p>

          <div className="flex gap-2">
            <Button variant="ghost" className="text-xs" onClick={selectAll}>
              Marcar tudo
            </Button>
            <Button variant="ghost" className="text-xs" onClick={() => setSelected({})}>
              Limpar seleção
            </Button>
            <Button variant="ghost" className="text-xs" onClick={loadPreview}>
              Atualizar contagens
            </Button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto scrollbar-brand pr-1">
            {OPTIONS.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer gap-3 rounded-xl border border-border bg-background/50 p-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={Boolean(selected[o.id])}
                  onChange={() => toggle(o.id)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                  <span className="mt-1 block text-xs text-brand-pink">
                    {counts
                      ? o.id === 'licenses'
                        ? `${counts.licenses ?? 0} licenças · ${counts.license_batches ?? 0} lotes`
                        : `${counts[o.countKey] ?? 0} registro(s)`
                      : '…'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs uppercase text-muted-foreground">
              Digite <span className="font-mono text-red-300">APAGAR</span> para confirmar
            </span>
            <GlassField
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="APAGAR"
              autoComplete="off"
            />
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {result ? (
            <pre className="scrollbar-brand max-h-40 overflow-auto rounded-xl border border-border bg-background/80 p-3 text-[11px] text-emerald-300">
              {result}
            </pre>
          ) : null}

          <Button
            variant="gradient"
            className="w-full !bg-red-600 hover:opacity-90"
            loading={busy}
            onClick={runPurge}
          >
            Executar limpeza
          </Button>
        </div>
      </Modal>
    </>
  )
}
