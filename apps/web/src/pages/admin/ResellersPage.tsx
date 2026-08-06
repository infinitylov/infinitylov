import { useEffect, useState, type FormEvent } from 'react'
import { callFunction, supabase } from '../../lib/supabase'
import { Button, GlassField, PageHeader, StatusPill } from '../../components/ui'

type ResellerRow = {
  id: string
  user_id: string
  credits_remaining: number
  credits_lifetime: number
  active: boolean
  notes: string | null
  email?: string | null
}

export function AdminResellersPage() {
  const [rows, setRows] = useState<ResellerRow[]>([])
  const [email, setEmail] = useState('')
  const [credits, setCredits] = useState(10)
  const [notes, setNotes] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('resellers')
      .select('id, user_id, credits_remaining, credits_lifetime, active, notes')
      .order('created_at', { ascending: false })
    const list = (data as ResellerRow[]) || []
    if (list.length) {
      const ids = list.map((r) => r.user_id)
      const { data: profiles } = await supabase.from('profiles').select('id, email').in('id', ids)
      const map = new Map((profiles || []).map((p) => [p.id, p.email]))
      list.forEach((r) => {
        r.email = map.get(r.user_id) || null
      })
    }
    setRows(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function onGrant(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      const res = await callFunction<{ ok: boolean; credits_added: number }>(
        'admin-grant-reseller',
        { email: email.trim().toLowerCase(), credits, notes: notes || null },
        { auth: true },
      )
      setMsg(`Revendedor atualizado (+${res.credits_added} créditos).`)
      setEmail('')
      setNotes('')
      await load()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Revendedores"
        description="Promover usuário e adicionar créditos manuais (além do PIX BlackCat)."
      />

      <form
        onSubmit={onGrant}
        className="mb-8 grid max-w-xl gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
      >
        <GlassField
          placeholder="E-mail do usuário"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="sm:col-span-2 !py-2.5"
        />
        <GlassField
          type="number"
          min={0}
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value) || 0)}
          className="!py-2.5"
        />
        <GlassField
          placeholder="Notas (PIX…)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="!py-2.5"
        />
        <Button type="submit" variant="gradient" className="sm:col-span-2" loading={busy}>
          Grant / adicionar créditos
        </Button>
      </form>

      {msg ? <p className="mb-3 text-sm text-brand-pink">{msg}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3">E-mail</th>
              <th className="px-3 py-3">Créditos</th>
              <th className="px-3 py-3">Total histórico</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Notas</th>
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
                  Nenhum revendedor
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-brand-pink/[0.06]">
                  <td className="px-3 py-2.5">{r.email || r.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2.5 font-semibold text-white">{r.credits_remaining}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.credits_lifetime}</td>
                  <td className="px-3 py-2.5">
                    <StatusPill status={r.active ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
