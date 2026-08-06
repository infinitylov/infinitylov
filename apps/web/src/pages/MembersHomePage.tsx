import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { BrandMark, Button } from '../components/ui'
 

export function MembersHomePage() {
  const { user, loading, signOut } = useAuth()
  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-card/60 backdrop-blur px-4 py-3 flex items-center justify-between">
        <BrandMark size="sm" />
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground hidden sm:inline">{user.email}</span>
          <Link to="/membros/conta" className="text-primary hover:underline">
            Conta
          </Link>
          <Button variant="ghost" onClick={() => signOut()}>
            Sair
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <section className="overflow-hidden rounded-2xl border border-border">
          <img src="/banner-membros.png" alt="InfinityLov Área de Membros" className="w-full object-cover max-h-56" />
        </section>

        <section>
          <h1 className="text-2xl font-bold mb-2">Bem-vindo</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Catálogo de módulos em breve. Use a extensão Chrome InfinityLov com a mesma licença para
            economizar créditos no Lovable.
          </p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-1">Extensão</h2>
            <p className="text-sm text-muted-foreground mb-3">
              Ative com a mesma chave na extensão InfinityLov.
            </p>
            <code className="text-xs text-accent">chrome://extensions</code>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold mb-1">Conteúdo</h2>
            <p className="text-sm text-muted-foreground">
              Módulos e aulas serão publicados pelo admin (Fase 2).
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
