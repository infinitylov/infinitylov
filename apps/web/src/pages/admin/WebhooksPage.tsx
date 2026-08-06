import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, StatusPill } from '../../components/ui'

type WebhookRow = {
  id: string
  provider: string
  event_id: string
  event_type: string
  processed_at: string | null
  error: string | null
  created_at: string
}

export function AdminWebhooksPage() {
  const [rows, setRows] = useState<WebhookRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('webhook_events')
        .select('id, provider, event_id, event_type, processed_at, error, created_at')
        .order('created_at', { ascending: false })
        .limit(100)
      setRows((data as WebhookRow[]) || [])
      setLoading(false)
    })()
  }, [])

  return (
    <div>
      <PageHeader title="Webhooks" description="Eventos Kiwify recentes (idempotência e erros)." />
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Quando</th>
              <th className="px-3 py-3">Tipo</th>
              <th className="px-3 py-3">ID do evento</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Erro</th>
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
                  Nenhum evento
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-brand-pink/[0.06]">
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{r.event_type}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.event_id.slice(0, 18)}…
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.processed_at ? 'processed' : r.error ? 'error' : 'pending'} />
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2.5 text-xs text-red-300">
                    {r.error || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
