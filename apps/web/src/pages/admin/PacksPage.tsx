import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { formatBRL, quoteCustomCredits, type PricingSettings, type PricingTier } from '../../lib/credit-pricing'
import { Button, GlassField, PageHeader } from '../../components/ui'

type Pack = {
  id: string
  name: string
  credits: number
  amount_cents: number
  active: boolean
  sort_order: number
  featured: boolean
  badge_label: string | null
}

type TierRow = PricingTier & { id: string; active: boolean; sort_order: number }

export function AdminPacksPage() {
  const [rows, setRows] = useState<Pack[]>([])
  const [settings, setSettings] = useState<PricingSettings | null>(null)
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [credits, setCredits] = useState(10)
  const [reais, setReais] = useState('29.90')
  const [sortOrder, setSortOrder] = useState(0)
  const [featured, setFeatured] = useState(false)
  const [badge, setBadge] = useState('')

  const [unitReais, setUnitReais] = useState('2.99')
  const [minQty, setMinQty] = useState(1)
  const [maxQty, setMaxQty] = useState(500)
  const [customEnabled, setCustomEnabled] = useState(true)
  const [subtitle, setSubtitle] = useState('')
  const [previewQty, setPreviewQty] = useState(20)

  const [editingTierId, setEditingTierId] = useState<string | null>(null)
  const [tierMin, setTierMin] = useState(20)
  const [tierMax, setTierMax] = useState('')
  const [tierPct, setTierPct] = useState('5')

  function resetPackForm() {
    setEditingId(null)
    setName('')
    setCredits(10)
    setReais('29.90')
    setSortOrder(0)
    setFeatured(false)
    setBadge('')
  }

  function startEditPack(p: Pack) {
    setEditingId(p.id)
    setName(p.name)
    setCredits(p.credits)
    setReais((p.amount_cents / 100).toFixed(2))
    setSortOrder(p.sort_order)
    setFeatured(p.featured)
    setBadge(p.badge_label || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetTierForm() {
    setEditingTierId(null)
    setTierMin(20)
    setTierMax('')
    setTierPct('5')
  }

  function startEditTier(t: TierRow) {
    setEditingTierId(t.id)
    setTierMin(t.min_qty)
    setTierMax(t.max_qty != null ? String(t.max_qty) : '')
    setTierPct((t.discount_bps / 100).toFixed(1))
  }

  async function load() {
    setLoading(true)
    const [{ data: packs }, { data: sett }, { data: tierRows }] = await Promise.all([
      supabase
        .from('credit_packs')
        .select('id, name, credits, amount_cents, active, sort_order, featured, badge_label')
        .order('sort_order', { ascending: true }),
      supabase.from('credit_pricing_settings').select('*').eq('id', 1).maybeSingle(),
      supabase
        .from('credit_pricing_tiers')
        .select('id, min_qty, max_qty, discount_bps, active, sort_order')
        .order('sort_order', { ascending: true }),
    ])
    setRows((packs as Pack[]) || [])
    if (sett) {
      setSettings(sett as PricingSettings)
      setCustomEnabled(sett.custom_enabled)
      setMinQty(sett.min_qty)
      setMaxQty(sett.max_qty)
      setUnitReais((sett.unit_price_cents / 100).toFixed(2))
      setSubtitle(sett.subtitle || '')
    }
    setTiers((tierRows as TierRow[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const preview = useMemo(() => {
    if (!settings && !unitReais) return null
    const s: PricingSettings = {
      custom_enabled: customEnabled,
      min_qty: minQty,
      max_qty: maxQty,
      unit_price_cents: Math.round(parseFloat(unitReais.replace(',', '.')) * 100) || 1,
      subtitle,
    }
    try {
      return quoteCustomCredits(previewQty, s, tiers)
    } catch {
      return null
    }
  }, [customEnabled, minQty, maxQty, unitReais, subtitle, previewQty, tiers, settings])

  async function onSavePack(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const amount_cents = Math.round(parseFloat(reais.replace(',', '.')) * 100)
    if (!name.trim() || credits < 1 || !Number.isFinite(amount_cents) || amount_cents < 1) {
      setMsg('Preencha nome, créditos e valor válidos.')
      setBusy(false)
      return
    }
    const payload = {
      name: name.trim(),
      credits,
      amount_cents,
      sort_order: sortOrder,
      featured,
      badge_label: badge.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (featured) {
      await supabase.from('credit_packs').update({ featured: false }).neq('id', editingId || '00000000-0000-0000-0000-000000000000')
    }

    const { error } = editingId
      ? await supabase.from('credit_packs').update(payload).eq('id', editingId)
      : await supabase.from('credit_packs').insert({ ...payload, active: true })

    if (error) setMsg(error.message)
    else {
      setMsg(editingId ? 'Pack atualizado.' : 'Pack criado.')
      resetPackForm()
      await load()
    }
    setBusy(false)
  }

  async function deletePack(p: Pack) {
    if (!window.confirm(`Apagar o pack "${p.name}"? Pedidos antigos ficam sem vínculo de pack.`)) return
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.from('credit_packs').delete().eq('id', p.id)
    if (error) setMsg(error.message)
    else {
      setMsg('Pack apagado.')
      if (editingId === p.id) resetPackForm()
      await load()
    }
    setBusy(false)
  }

  async function toggleActive(p: Pack) {
    await supabase
      .from('credit_packs')
      .update({ active: !p.active, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    await load()
  }

  async function toggleFeatured(p: Pack) {
    if (!p.featured) {
      await supabase.from('credit_packs').update({ featured: false }).neq('id', p.id)
    }
    await supabase
      .from('credit_packs')
      .update({
        featured: !p.featured,
        badge_label: !p.featured ? p.badge_label || 'Mais vendido' : p.badge_label,
        updated_at: new Date().toISOString(),
      })
      .eq('id', p.id)
    await load()
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const unit_price_cents = Math.round(parseFloat(unitReais.replace(',', '.')) * 100)
    if (!Number.isFinite(unit_price_cents) || unit_price_cents < 1 || minQty < 1 || maxQty < minQty) {
      setMsg('Configuração inválida.')
      setBusy(false)
      return
    }
    const { error } = await supabase.from('credit_pricing_settings').upsert({
      id: 1,
      custom_enabled: customEnabled,
      min_qty: minQty,
      max_qty: maxQty,
      unit_price_cents,
      subtitle: subtitle.trim() || null,
      updated_at: new Date().toISOString(),
    })
    setMsg(error ? error.message : 'Preços personalizados salvos.')
    await load()
    setBusy(false)
  }

  async function saveTier(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const pct = parseFloat(tierPct.replace(',', '.'))
    const discount_bps = Math.round(pct * 100)
    const max_qty = tierMax.trim() ? Number(tierMax) : null
    if (!Number.isFinite(pct) || discount_bps < 0 || discount_bps > 10000 || tierMin < 1) {
      setMsg('Faixa inválida.')
      setBusy(false)
      return
    }
    const payload = {
      min_qty: tierMin,
      max_qty,
      discount_bps,
      active: true,
      sort_order: tierMin,
      updated_at: new Date().toISOString(),
    }
    const { error } = editingTierId
      ? await supabase.from('credit_pricing_tiers').update(payload).eq('id', editingTierId)
      : await supabase.from('credit_pricing_tiers').insert(payload)
    setMsg(error ? error.message : editingTierId ? 'Faixa atualizada.' : 'Faixa adicionada.')
    if (!error) resetTierForm()
    await load()
    setBusy(false)
  }

  async function removeTier(id: string) {
    if (!window.confirm('Remover esta faixa de desconto?')) return
    await supabase.from('credit_pricing_tiers').delete().eq('id', id)
    if (editingTierId === id) resetTierForm()
    await load()
  }

  return (
    <div className="space-y-10">
      <PageHeader
        title="Packs e preços"
        description="Pacotes fixos, quantidade personalizada e descontos por volume."
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Packs
        </h2>
        <form
          onSubmit={onSavePack}
          className="mb-4 grid max-w-3xl gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
        >
          {editingId ? (
            <p className="sm:col-span-2 text-sm text-brand-orange">Editando pack — salve ou cancele.</p>
          ) : null}
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
          <GlassField
            placeholder="Badge (ex: Mais vendido)"
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
            Destacar (featured)
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <Button type="submit" variant="gradient" loading={busy}>
              {editingId ? 'Salvar alterações' : 'Criar pack'}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" onClick={resetPackForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Nome</th>
                <th className="px-3 py-3">Créditos</th>
                <th className="px-3 py-3">Preço</th>
                <th className="px-3 py-3">Badge</th>
                <th className="px-3 py-3">Ativo</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <span className="neon-spinner inline-block" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nenhum pack
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/60">
                    <td className="px-3 py-2.5 text-white">
                      {r.name}
                      {r.featured ? (
                        <span className="ml-2 text-[10px] uppercase text-brand-orange">featured</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">{r.credits}</td>
                    <td className="px-3 py-2.5">{formatBRL(r.amount_cents)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.badge_label || '—'}</td>
                    <td className="px-3 py-2.5">{r.active ? 'sim' : 'não'}</td>
                    <td className="px-3 py-2.5 space-x-1 text-right">
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => startEditPack(r)}>
                        Editar
                      </Button>
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => toggleFeatured(r)}>
                        {r.featured ? 'Tirar destaque' : 'Destacar'}
                      </Button>
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => toggleActive(r)}>
                        {r.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button variant="ghost" className="!py-1 text-xs text-red-400" onClick={() => deletePack(r)}>
                        Apagar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quantidade personalizada
        </h2>
        <form
          onSubmit={saveSettings}
          className="mb-4 grid max-w-3xl gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
        >
          <label className="flex items-center gap-2 text-sm text-white sm:col-span-2">
            <input
              type="checkbox"
              checked={customEnabled}
              onChange={(e) => setCustomEnabled(e.target.checked)}
            />
            Habilitar compra personalizada na revenda
          </label>
          <GlassField
            placeholder="Preço unitário R$"
            value={unitReais}
            onChange={(e) => setUnitReais(e.target.value)}
            required
          />
          <GlassField
            type="number"
            min={1}
            placeholder="Qtd mínima"
            value={minQty}
            onChange={(e) => setMinQty(Number(e.target.value) || 1)}
          />
          <GlassField
            type="number"
            min={1}
            placeholder="Qtd máxima"
            value={maxQty}
            onChange={(e) => setMaxQty(Number(e.target.value) || 1)}
          />
          <GlassField
            placeholder="Subtítulo (opcional)"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-xs text-muted-foreground">
              Preview qtd
              <GlassField
                type="number"
                value={previewQty}
                onChange={(e) => setPreviewQty(Number(e.target.value) || 1)}
              />
            </label>
            {preview ? (
              <p className="text-sm text-muted-foreground">
                {preview.credits} tokens →{' '}
                <span className="font-semibold text-brand-pink">{formatBRL(preview.amount_cents)}</span>
                {' '}({formatBRL(preview.unit_price_cents)}/token
                {preview.discount_bps > 0 ? `, -${(preview.discount_bps / 100).toFixed(1)}%` : ''})
              </p>
            ) : (
              <p className="text-sm text-red-400">Qtd fora da faixa ou personalizado off</p>
            )}
          </div>
          <div>
            <Button type="submit" variant="gradient" loading={busy}>
              Salvar preços
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Faixas de desconto
        </h2>
        <form
          onSubmit={saveTier}
          className="mb-4 grid max-w-3xl gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-4"
        >
          {editingTierId ? (
            <p className="sm:col-span-4 text-sm text-brand-orange">Editando faixa</p>
          ) : null}
          <GlassField
            type="number"
            min={1}
            placeholder="Min qtd"
            value={tierMin}
            onChange={(e) => setTierMin(Number(e.target.value) || 1)}
          />
          <GlassField
            type="number"
            placeholder="Max qtd (vazio = ∞)"
            value={tierMax}
            onChange={(e) => setTierMax(e.target.value)}
          />
          <GlassField
            placeholder="% desconto"
            value={tierPct}
            onChange={(e) => setTierPct(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="gradient" loading={busy}>
              {editingTierId ? 'Salvar' : 'Adicionar'}
            </Button>
            {editingTierId ? (
              <Button type="button" variant="ghost" onClick={resetTierForm}>
                Cancelar
              </Button>
            ) : null}
          </div>
        </form>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Min</th>
                <th className="px-3 py-3">Max</th>
                <th className="px-3 py-3">Desconto</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {tiers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    Nenhuma faixa
                  </td>
                </tr>
              ) : (
                tiers.map((t) => (
                  <tr key={t.id} className="border-t border-border/60">
                    <td className="px-3 py-2.5">{t.min_qty}</td>
                    <td className="px-3 py-2.5">{t.max_qty ?? '∞'}</td>
                    <td className="px-3 py-2.5">{(t.discount_bps / 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 space-x-1 text-right">
                      <Button variant="ghost" className="!py-1 text-xs" onClick={() => startEditTier(t)}>
                        Editar
                      </Button>
                      <Button variant="ghost" className="!py-1 text-xs text-red-400" onClick={() => removeTier(t.id)}>
                        Apagar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {msg ? <p className="text-sm text-brand-pink">{msg}</p> : null}
    </div>
  )
}
