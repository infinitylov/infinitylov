import { useState, type FormEvent } from 'react'
import { AuthShell, Button, GlassField } from '../components/ui'
import { callFunction, supabase } from '../lib/supabase'

type ActivateResponse = {
  ok: boolean
  activated?: boolean
  error?: string
  message?: string
  session?: { access_token: string; refresh_token: string }
}

const LOVABLE_URL = 'https://lovable.dev'

/** Página separada: /ativar-licenca (não ligada ao login admin) */
export function ActivateLicensePage() {
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOkMsg(null)
    try {
      const res = await callFunction<ActivateResponse>('activate-license', {
        license_key: key.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password,
      })
      if (!res.ok) throw new Error(res.error || 'Falha na ativação')
      if (res.session?.access_token && res.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        })
      }
      setOkMsg('Licença ativada! Redirecionando para o Lovable…')
      setTimeout(() => {
        window.location.assign(LOVABLE_URL)
      }, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Ativar licença">
      <form onSubmit={onSubmit} className="space-y-3">
        <GlassField
          placeholder="INLO-XXXXX-XXXXX-XXXXX"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          required
          className="text-center font-mono tracking-wider"
        />
        <GlassField
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <GlassField
          type="password"
          placeholder="Senha (mín. 8)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {okMsg ? <p className="text-sm text-green-300">{okMsg}</p> : null}
        <Button type="submit" variant="gradient" className="w-full" loading={busy}>
          {busy ? 'Ativando…' : 'Ativar'}
        </Button>
      </form>
    </AuthShell>
  )
}
