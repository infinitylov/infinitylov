import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Button, GlassField, PageHeader } from '../../components/ui'

type Pack = {
  id: string
  name: string
  credits: number
  amount_cents: number
  active: boolean
  sort_order: number
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function AdminPacksPage() {
  const [rows, setRows] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [credits, setCredits] = useState(10)
  const [reais, setReais] = useState('29.90')
  const [sortOrder, setSortOrder] = useState(0)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('credit_packs')
      .select('id, name, credits, amount_cents, active, sort_order')
      .order('sort_order', { ascending: true })
    setRows((data as Pack[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const amount_cents = Math.round(parseFloat(reais.replace(',', '.')) * 100)
    if (!name.trim() || credits < 1 || !Number.isFinite(amount_cents) || amount_cents < 1) {
      setMsg('Preencha nome, créditos e valor válidos.')
      setBusy(false)
      return
    }
    const { error } = await supabase.from('credit_packs').insert({
      name: name.trim(),
      credits,
      amount_cents,
      sort_order: sortOrder,
      active: true,
    })
    if (error) setMsg(error.message)
    else {
      setMsg('Pack criado.')
      setName('')
      await load()
    }
    setBusy(false)
  }

  async function toggleActive(p: Pack) {
    await supabase.from('credit_packs').update({ active: !p.active, updated_at: new Date().toISOString() }).eq('id', p.id)
    await load()
  }

  return (
    <div>
      <PageHeader title="Packs de créditos" description="Pacotes PIX para revendedores (BlackCat)." />

      <form
        onSubmit={onCreate}
        className="mb-8 grid max-w-2xl gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
      >
        <GlassField
          placeholder="Nome do pack"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="sm:col-span-2"
        />
        <GlassField
          type="number"
          min={1}
          placeholder="Créditos"
          value={credits}
          onChange={(e) => setCredits(Number(e.target.value) || 1)}
          required
        />
        <GlassField
          placeholder="Valor R$ (ex: 29.90)"
          value={reais}
          onChange={(e) => setReais(e.target.value)}
          required
        />
        <GlassField
          type="number"
          placeholder="Ordem"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
        />
        <div className="flex items-end">
          <Button type="submit" variant="gradient" loading={busy}>
            Criar pack
          </Button>
        </div>
        {msg ? <p className="sm:col-span-2 text-sm text-brand-pink">{msg}</p> : null}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Nome</th>
              <th className="px-3 py-3">Créditos</th>
              <th className="px-3 py-3">Preço</th>
              <th className="px-3 py-3">Ativo</th>
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
                  Nenhum pack
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-3 py-2.5 text-white">{r.name}</td>
                  <td className="px-3 py-2.5">{r.credits}</td>
                  <td className="px-3 py-2.5">{formatBRL(r.amount_cents)}</td>
                  <td className="px-3 py-2.5">{r.active ? 'sim' : 'não'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button variant="ghost" className="!py-1 text-xs" onClick={() => toggleActive(r)}>
                      {r.active ? 'Desativar' : 'Ativar'}
                    </Button>
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
