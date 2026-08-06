import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { ExtensionDownload, PageHeader, StatCard } from '../../components/ui'
import { AdminPurgeButton } from '../../components/AdminPurgeButton'

type Counts = {
  active: number
  unused: number
  revoked: number
  expired: number
  webhooks: number
  users: number
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  unused: '#ff8a1a',
  revoked: '#ef4444',
  expired: '#8f7aa8',
}

function lastNDays(n: number) {
  const days: string[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function countByDay(dates: string[], days: string[]) {
  const map = Object.fromEntries(days.map((d) => [d, 0]))
  for (const raw of dates) {
    const key = raw.slice(0, 10)
    if (key in map) map[key] += 1
  }
  return days.map((d) => ({
    day: d.slice(5),
    full: d,
    count: map[d],
  }))
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Counts>({
    active: 0,
    unused: 0,
    revoked: 0,
    expired: 0,
    webhooks: 0,
    users: 0,
  })
  const [licenseDates, setLicenseDates] = useState<string[]>([])
  const [webhookDates, setWebhookDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const since = new Date()
      since.setDate(since.getDate() - 14)
      const sinceIso = since.toISOString()

      const [active, unused, revoked, expired, webhooks, users, licensesRecent, webhooksRecent] =
        await Promise.all([
          supabase.from('licenses').select('key', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('licenses').select('key', { count: 'exact', head: true }).eq('status', 'unused'),
          supabase.from('licenses').select('key', { count: 'exact', head: true }).eq('status', 'revoked'),
          supabase.from('licenses').select('key', { count: 'exact', head: true }).eq('status', 'expired'),
          supabase.from('webhook_events').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('licenses').select('created_at').gte('created_at', sinceIso).limit(2000),
          supabase.from('webhook_events').select('created_at').gte('created_at', sinceIso).limit(2000),
        ])

      setStats({
        active: active.count ?? 0,
        unused: unused.count ?? 0,
        revoked: revoked.count ?? 0,
        expired: expired.count ?? 0,
        webhooks: webhooks.count ?? 0,
        users: users.count ?? 0,
      })
      setLicenseDates(((licensesRecent.data as { created_at: string }[]) || []).map((r) => r.created_at))
      setWebhookDates(((webhooksRecent.data as { created_at: string }[]) || []).map((r) => r.created_at))
      setLoading(false)
    })()
  }, [])

  const days = useMemo(() => lastNDays(14), [])
  const statusPie = useMemo(
    () =>
      [
        { name: 'Ativas', key: 'active', value: stats.active },
        { name: 'Unused', key: 'unused', value: stats.unused },
        { name: 'Revogadas', key: 'revoked', value: stats.revoked },
        { name: 'Expiradas', key: 'expired', value: stats.expired },
      ].filter((d) => d.value > 0),
    [stats],
  )
  const licensesSeries = useMemo(() => countByDay(licenseDates, days), [licenseDates, days])
  const webhooksSeries = useMemo(() => countByDay(webhookDates, days), [webhookDates, days])

  const tooltipStyle = {
    background: '#0c0618',
    border: '1px solid #2a1a3d',
    borderRadius: 12,
    color: '#fafafa',
    fontSize: 12,
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visão operacional de licenças e eventos."
        actions={
          <div className="flex flex-wrap gap-2">
            <AdminPurgeButton />
            <ExtensionDownload variant="gradient" label="Baixar extensão Chrome" />
          </div>
        }
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="neon-spinner" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Ativas" value={stats.active} />
            <StatCard label="Unused" value={stats.unused} />
            <StatCard label="Revogadas" value={stats.revoked} />
            <StatCard label="Expiradas" value={stats.expired} />
            <StatCard label="Webhooks" value={stats.webhooks} />
            <StatCard label="Usuários" value={stats.users} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-4 lg:col-span-1">
              <h2 className="mb-3 text-sm font-semibold text-white">Status das licenças</h2>
              {statusPie.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">Sem dados</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={3}
                      >
                        {statusPie.map((entry) => (
                          <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {statusPie.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: STATUS_COLORS[s.key] }}
                    />
                    {s.name}: {s.value}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4 lg:col-span-2">
              <h2 className="mb-3 text-sm font-semibold text-white">Licenças criadas (14 dias)</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={licensesSeries}>
                    <CartesianGrid stroke="#2a1a3d" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#8f7aa8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: '#8f7aa8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" name="Licenças" fill="#ff008c" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Webhooks (14 dias)</h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={webhooksSeries}>
                  <defs>
                    <linearGradient id="whFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7000ff" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#7000ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#2a1a3d" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#8f7aa8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: '#8f7aa8', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Eventos"
                    stroke="#ff8a1a"
                    strokeWidth={2}
                    fill="url(#whFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
