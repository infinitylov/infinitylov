import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { callFunction } from '../../lib/supabase'
import { AuthShell, Button, GlassField, TextLink } from '../../components/ui'

export function ResellerRegisterPage() {
  const { signIn, user, loading, isReseller } = useAuth()
  const nav = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && user && isReseller) return <Navigate to="/revendedor" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await callFunction<{ ok: boolean }>(
        'reseller-register',
        {
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
        },
        { auth: false },
      )
      const p = await signIn(email.trim().toLowerCase(), password)
      if (p?.role === 'reseller') nav('/revendedor')
      else nav('/revendedor/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Revenda — Cadastro" subtitle="Crie sua conta e compre créditos por PIX">
      <form onSubmit={onSubmit} className="space-y-3">
        <GlassField
          placeholder="Nome completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />
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
          placeholder="Senha (mín. 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button type="submit" variant="gradient" className="w-full" loading={busy}>
          {busy ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Já tem conta? <TextLink to="/revendedor/login">Entrar</TextLink>
      </p>
    </AuthShell>
  )
}
