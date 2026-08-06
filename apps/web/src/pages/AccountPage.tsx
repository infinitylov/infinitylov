import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { BrandMark, Button } from '../components/ui'

type LicenseRow = {
  key: string
  status: string
  expires_at: string | null
  hwid: string | null
}

export function AccountPage() {
  const { user, loading } = useAuth()
  const [lic, setLic] = useState<LicenseRow | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('licenses')
      .select('key, status, expires_at, hwid')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLic(data))
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-full">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between">
        <BrandMark size="sm" />
        <Link to="/membros" className="text-sm text-primary">
          Voltar
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-8 space-y-4">
        <h1 className="text-xl font-bold">Minha conta</h1>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">E-mail:</span> {user.email}
          </p>
          {lic ? (
            <>
              <p>
                <span className="text-muted-foreground">Licença:</span>{' '}
                <code className="text-accent">{lic.key}</code>
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span> {lic.status}
              </p>
              <p>
                <span className="text-muted-foreground">Expira:</span>{' '}
                {lic.expires_at ? new Date(lic.expires_at).toLocaleString('pt-BR') : '—'}
              </p>
              <p>
                <span className="text-muted-foreground">HWID:</span> {lic.hwid || 'não vinculado'}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Nenhuma licença ativa vinculada.</p>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={() => navigator.clipboard.writeText(lic?.key || '')}
          disabled={!lic}
        >
          Copiar chave
        </Button>
      </main>
    </div>
  )
}
