import { Link } from 'react-router-dom'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

export function BrandWordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-3xl'
  return (
    <div className="inline-flex flex-col items-center">
      <div className={`font-extrabold tracking-tight ${text} drop-shadow-[0_0_20px_rgba(255,0,140,0.35)]`}>
        <span className="text-white">Infinity</span>
        <span className="brand-lov">Lov</span>
      </div>
      <div
        className="mt-1.5 h-0.5 w-16 rounded-full"
        style={{ background: 'var(--gradient-brand)' }}
      />
    </div>
  )
}

/** @deprecated use BrandWordmark */
export const BrandMark = BrandWordmark

export function BrandLogo({ className = 'h-14 w-14' }: { className?: string }) {
  return (
    <img
      src="/brand/logo.png"
      alt="InfinityLov"
      className={`${className} object-contain drop-shadow-[0_0_24px_rgba(255,0,140,0.4)]`}
    />
  )
}

export function BrandIcon({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <img
      src="/brand/icon.png"
      alt=""
      className={`${className} rounded-[22%] object-cover shadow-[0_0_16px_rgba(255,0,140,0.35)]`}
    />
  )
}

export function BrandPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple/50 bg-brand-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/90">
      {children}
    </span>
  )
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title?: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-y-auto px-4 py-10 scrollbar-brand">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/brand/banner-membros.png')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(255,138,26,0.12),transparent_45%),radial-gradient(ellipse_at_80%_70%,rgba(255,0,140,0.14),transparent_50%),linear-gradient(180deg,rgba(5,1,13,0.35),rgba(5,1,13,0.72))]" />

      <div
        className="auth-card-enter relative z-10 w-full max-w-[400px] rounded-2xl border border-brand-pink/25 p-7 md:p-8"
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: `blur(var(--glass-blur)) saturate(1.2)`,
          WebkitBackdropFilter: `blur(var(--glass-blur)) saturate(1.2)`,
          boxShadow: '0 0 40px rgba(255,0,140,0.18), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {(title || subtitle) && (
          <div className="mb-6 space-y-1 text-center">
            {title ? <h1 className="text-xl font-semibold text-white">{title}</h1> : null}
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function Button({
  children,
  className = '',
  variant = 'primary',
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'gradient' | 'danger'
  loading?: boolean
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-primary text-white hover:brightness-110',
    ghost: 'border border-border/80 bg-white/5 text-foreground hover:bg-white/10',
    gradient: 'gradient-brand text-white btn-glow hover:brightness-110',
    danger: 'border border-danger/40 bg-danger/10 text-red-300 hover:bg-danger/20',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="neon-spinner" /> : null}
      {children}
    </button>
  )
}

export function GlassField({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-white/12 bg-white/5 px-3.5 py-3 text-sm text-foreground outline-none backdrop-blur-md transition placeholder:text-muted-foreground focus:border-brand-pink/60 focus:shadow-[0_0_0_3px_rgba(255,0,140,0.15),0_0_20px_rgba(112,0,255,0.2)] ${className}`}
      {...props}
    />
  )
}

/** Alias for forms outside auth if needed */
export const Input = GlassField

export function GlowLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="text-sm font-medium text-brand-pink transition hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,0,140,0.8)]"
    >
      {children}
    </Link>
  )
}

export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return <GlowLink to={to}>{children}</GlowLink>
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'border-success/40 bg-success/10 text-green-300 shadow-[0_0_12px_rgba(34,197,94,0.25)]',
    unused: 'border-brand-orange/40 bg-brand-orange/10 text-orange-200',
    revoked: 'border-danger/40 bg-danger/10 text-red-300',
    expired: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    canceled: 'border-danger/40 bg-danger/10 text-red-300',
    past_due: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  }
  const cls = map[status] || 'border-border bg-muted text-muted-foreground'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {status === 'active' ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> : null}
      {status}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  )
}

export function IconButton({
  label,
  variant = 'ghost',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  variant?: 'ghost' | 'danger'
}) {
  const variants = {
    ghost: 'border-border/80 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white',
    danger: 'border-danger/40 bg-danger/10 text-red-300 hover:bg-danger/20',
  }
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 flex max-h-[min(90dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-brand-pink/25 bg-surface shadow-[0_0_40px_rgba(255,0,140,0.2)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            Fechar
          </button>
        </div>
        <div className="scrollbar-brand min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}
