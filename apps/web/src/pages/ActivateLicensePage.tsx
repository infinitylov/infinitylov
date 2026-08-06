import { useState, type FormEvent } from 'react'
import { AuthShell, Button, ExtensionDownload, GlassField, GlowLink } from '../components/ui'
import { callFunction } from '../lib/supabase'

type ActivateResponse = {
  ok: boolean
  activated?: boolean
  error?: string
  message?: string
  expires_at?: string
  license_key?: string
}

const LOVABLE_URL = 'https://lovable.dev'

/** Página separada: /ativar-licenca (parceiros — chave unused) */
export function ActivateLicensePage() {
  const [key, setKey] = useState('')
  const [email, setEmail] = useState('')
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
      })
      if (!res.ok) throw new Error(res.error || 'Falha na ativação')
      setOkMsg(res.message || 'Licença ativada! Redirecionando para o Lovable…')
      setTimeout(() => {
        window.location.assign(LOVABLE_URL)
      }, 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao ativar')
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Ativar licença" subtitle="Comprou com parceiro? Informe a chave e o e-mail.">
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
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {okMsg ? <p className="text-sm text-green-300">{okMsg}</p> : null}
        <Button type="submit" variant="gradient" className="w-full" loading={busy}>
          {busy ? 'Ativando…' : 'Ativar'}
        </Button>
      </form>
      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="mb-3 text-center text-xs text-muted-foreground">
          Depois de ativar, instale a extensão no Chrome
        </p>
        <ExtensionDownload className="w-full" variant="ghost" label="Baixar extensão (.zip)" />
        <div className="mt-4 text-center">
          <p className="mb-2 text-xs text-muted-foreground">Já comprou na Kiwify?</p>
          <GlowLink to="/resgatar-licenca">Resgatar licença</GlowLink>
        </div>
      </div>
    </AuthShell>
  )
}
