import { useState, type FormEvent } from 'react'
import { AuthShell, Button, ExtensionDownload, GlassField } from '../components/ui'
import { callFunction } from '../lib/supabase'

type LicenseHit = {
  key: string
  expires_at: string | null
  source: string | null
}

type LookupResponse = {
  ok: boolean
  licenses?: LicenseHit[]
  message?: string
  error?: string
}

export function RescueLicensePage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [licenses, setLicenses] = useState<LicenseHit[]>([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    setLicenses([])
    setCopied(null)
    try {
      const res = await callFunction<LookupResponse>('lookup-license', {
        email: email.trim().toLowerCase(),
      })
      if (!res.ok) throw new Error(res.error || 'Falha ao buscar')
      const list = res.licenses || []
      setLicenses(list)
      if (list.length === 0) {
        setMessage(res.message || 'Nenhuma licença ativa para este e-mail.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao resgatar')
    } finally {
      setBusy(false)
    }
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key)
    setCopied(key)
  }

  return (
    <AuthShell title="Resgatar licença" subtitle="Informe o e-mail da compra para ver sua chave.">
      <form onSubmit={onSubmit} className="space-y-3">
        <GlassField
          type="email"
          placeholder="E-mail da compra"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <Button type="submit" variant="gradient" className="w-full" loading={busy}>
          {busy ? 'Buscando…' : 'Resgatar'}
        </Button>
      </form>

      {licenses.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {licenses.length === 1 ? 'Sua licença' : 'Suas licenças'}
          </p>
          {licenses.map((lic) => (
            <div
              key={lic.key}
              className="rounded-xl border border-brand-pink/25 bg-white/5 p-3"
            >
              <button
                type="button"
                className="w-full break-all text-left font-mono text-sm text-white hover:text-brand-pink"
                onClick={() => copyKey(lic.key)}
                title="Copiar"
              >
                {lic.key}
              </button>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>
                  {lic.expires_at
                    ? `Expira ${new Date(lic.expires_at).toLocaleDateString('pt-BR')}`
                    : 'Sem expiração'}
                </span>
                <button
                  type="button"
                  className="font-semibold text-brand-pink hover:text-white"
                  onClick={() => copyKey(lic.key)}
                >
                  {copied === lic.key ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 border-t border-white/10 pt-5">
        <p className="mb-3 text-center text-xs text-muted-foreground">
          Instale a extensão no Chrome
        </p>
        <ExtensionDownload className="w-full" variant="ghost" label="Baixar extensão (.zip)" />
      </div>
    </AuthShell>
  )
}
