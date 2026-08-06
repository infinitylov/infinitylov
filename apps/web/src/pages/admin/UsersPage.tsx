import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, GlassField } from '../../components/ui'

type ProfileRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string
  created_at: string
}

const ROLES = ['member', 'support', 'admin', 'super_admin'] as const

export function AdminUsersPage() {
  const [rows, setRows] = useState<ProfileRow[]>([])
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    setRows((data as ProfileRow[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = rows.filter((r) => {
    const s = q.toLowerCase()
    if (!s) return true
    return (
      (r.email || '').toLowerCase().includes(s) ||
      (r.full_name || '').toLowerCase().includes(s) ||
      r.role.includes(s)
    )
  })

  async function setRole(id: string, role: string) {
    setMsg(null)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) setMsg(error.message)
    else {
      setMsg(`Role atualizada → ${role}`)
      await load()
    }
  }

  return (
    <div>
      <PageHeader title="Usuários" description="Perfis e roles (alteração protegida no banco)." />
      <div className="mb-4">
        <GlassField
          placeholder="Buscar e-mail / nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-sm !py-2"
        />
      </div>
      {msg ? <p className="mb-3 text-sm text-brand-pink">{msg}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3">E-mail</th>
              <th className="px-3 py-3">Nome</th>
              <th className="px-3 py-3">Role</th>
              <th className="px-3 py-3">Criado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-10 text-center">
                  <span className="neon-spinner inline-block" />
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-t border-border/60 hover:bg-brand-pink/[0.06]">
                  <td className="px-3 py-2.5">{r.email || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.full_name || '—'}</td>
                  <td className="px-3 py-2.5">
                    <select
                      value={r.role}
                      onChange={(e) => setRole(r.id, e.target.value)}
                      className="rounded-lg border border-border bg-muted px-2 py-1 text-xs"
                    >
                      {(r.role === 'reseller' ? (['reseller', ...ROLES] as const) : ROLES).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('pt-BR')}
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
