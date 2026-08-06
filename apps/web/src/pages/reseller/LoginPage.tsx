import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { AuthShell, Button, GlassField, TextLink } from '../../components/ui'

export function ResellerLoginPage() {
  const { signIn, signOut, user, loading, isReseller, isStaff } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user && isReseller) return <Navigate to="/revendedor" replace />
  if (!loading && user && isStaff) return <Navigate to="/admin" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const p = await signIn(email, password)
      const r = p?.role ?? null
      if (r === 'reseller') {
        nav('/revendedor')
      } else if (r === 'super_admin' || r === 'admin' || r === 'support') {
        nav('/admin')
      } else {
        setError('Conta sem acesso de revendedor. Cadastre-se como revenda.')
        await signOut()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Revenda — Entrar" subtitle="Compre créditos InfinityLov via PIX">
      <form onSubmit={onSubmit} className="space-y-3">
        <GlassField
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <GlassField
          type="password"
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="current-password"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button type="submit" variant="gradient" className="w-full" loading={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Ainda não tem conta? <TextLink to="/revendedor/cadastro">Cadastre-se</TextLink>
      </p>
    </AuthShell>
  )
}
