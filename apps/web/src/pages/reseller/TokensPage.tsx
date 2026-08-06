import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { callFunction, supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { Button, PageHeader, StatCard, StatusPill } from '../../components/ui'

type Order = {
  id: string
  credits: number
  amount_cents: number
  status: string
  created_at: string
  paid_at: string | null
  pack_id: string | null
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function ResellerTokensPage() {
  const { user } = useAuth()
  const [credits, setCredits] = useState(0)
  const [lifetime, setLifetime] = useState(0)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [{ data: reseller }, { data: orderRows }] = await Promise.all([
      supabase
        .from('resellers')
        .select('credits_remaining, credits_lifetime')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('credit_orders')
        .select('id, credits, amount_cents, status, created_at, paid_at, pack_id')
        .eq('reseller_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setCredits(reseller?.credits_remaining ?? 0)
    setLifetime(reseller?.credits_lifetime ?? 0)
    setOrders((orderRows as Order[]) || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function checkPending(orderId: string) {
    setRefreshing(orderId)
    try {
      await callFunction('reseller-order-status', { order_id: orderId }, { auth: true })
      await load()
    } catch {
      /* ignore */
    } finally {
      setRefreshing(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="Saldo e pedidos"
        description="Créditos disponíveis e histórico de compras PIX. Gere chaves em Licenças."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/revendedor/licencas">
              <Button variant="ghost">Gerar licenças</Button>
            </Link>
            <Link to="/revendedor/comprar">
              <Button variant="gradient">Comprar créditos</Button>
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="neon-spinner" />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            <StatCard label="Créditos disponíveis" value={credits} />
            <StatCard label="Créditos lifetime" value={lifetime} />
          </div>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Pedidos
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Data</th>
                  <th className="px-3 py-3">Tokens</th>
                  <th className="px-3 py-3">Valor</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhuma compra ainda.{' '}
                      <Link to="/revendedor/comprar" className="text-brand-pink">
                        Comprar agora
                      </Link>
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="border-t border-border/60">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-white">{o.credits}</td>
                      <td className="px-3 py-2.5">{formatBRL(o.amount_cents)}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={o.status} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {o.status === 'pending' ? (
                          <Button
                            variant="ghost"
                            className="!py-1 text-xs"
                            loading={refreshing === o.id}
                            onClick={() => checkPending(o.id)}
                          >
                            Verificar PIX
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
