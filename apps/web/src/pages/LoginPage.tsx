import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth, staffHomePath } from '../lib/auth'
import { AuthShell, Button, GlassField } from '../components/ui'

export function LoginPage() {
  const { signIn, user, loading, isStaff, role } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user && isStaff) return <Navigate to={staffHomePath(role)} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const p = await signIn(email, password)
      const r = p?.role ?? null
      if (r === 'super_admin' || r === 'admin' || r === 'support') {
        nav('/admin')
      } else {
        setError('Conta sem acesso ao painel admin. Área de membros em breve.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Entrar">
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
    </AuthShell>
  )
}
