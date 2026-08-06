import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Button, ExtensionDownload } from './ui'

const nav = [
  { to: '/admin', end: true, label: 'Dashboard' },
  { to: '/admin/licencas', label: 'Licenças' },
  { to: '/admin/usuarios', label: 'Usuários' },
  { to: '/admin/webhooks', label: 'Webhooks' },
]

export function RequireStaff({ children }: { children: React.ReactNode }) {
  const { loading, user, isStaff, signOut } = useAuth()
  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <span className="neon-spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!isStaff) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-lg font-semibold">Sem acesso ao painel</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Sua conta não tem permissão de admin/support. A área de membros chega em breve.
        </p>
        <Button variant="ghost" onClick={() => signOut()}>
          Sair
        </Button>
      </div>
    )
  }
  return <>{children}</>
}

export function AdminShell() {
  const { profile, signOut } = useAuth()

  return (
    <RequireStaff>
      <div className="flex h-dvh overflow-hidden bg-background">
        <aside className="hidden h-full w-36 shrink-0 flex-col border-r border-border bg-surface md:flex">
          <div className="border-b border-border px-3 py-4">
            <p className="truncate text-sm font-extrabold tracking-tight">
              Infinity<span className="brand-lov">Lov</span>
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 scrollbar-brand">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-brand-pink/10 text-white shadow-[inset_2px_0_0_0_#ff008c]'
                      : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-border p-2">
            <NavLink
              to="/ativar-licenca"
              className="mb-1 block rounded-xl px-2.5 py-2 text-center text-xs font-semibold text-muted-foreground transition hover:bg-white/5 hover:text-white"
            >
              Ativar licença
            </NavLink>
            <ExtensionDownload className="mb-2 w-full !px-2 !py-1.5 text-xs" label="Extensão" />
            <p className="mb-2 truncate text-[10px] text-muted-foreground" title={profile?.email ?? ''}>
              {profile?.email}
            </p>
            <Button variant="ghost" className="w-full !px-2 !py-1.5 text-xs" onClick={() => signOut()}>
              Sair
            </Button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 py-3 backdrop-blur md:hidden">
            <span className="font-bold">
              Infinity<span className="brand-lov">Lov</span>
            </span>
            <Button variant="ghost" onClick={() => signOut()}>
              Sair
            </Button>
          </header>
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2 scrollbar-brand md:hidden">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    isActive ? 'gradient-brand text-white' : 'bg-muted text-muted-foreground'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <main className="scrollbar-brand min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,rgba(112,0,255,0.08),transparent_50%)] p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </RequireStaff>
  )
}
