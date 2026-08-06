/** Rótulos em português para status/roles exibidos na UI (valores DB continuam em inglês). */

export const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  inactive: 'Inativo',
  unused: 'Disponível',
  revoked: 'Revogada',
  expired: 'Expirada',
  pending: 'Pendente',
  paid: 'Pago',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  refunded: 'Estornado',
  past_due: 'Em atraso',
  processed: 'Processado',
  error: 'Erro',
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  support: 'Suporte',
  reseller: 'Revendedor',
  member: 'Membro',
}

export const SOURCE_LABELS: Record<string, string> = {
  admin: 'Admin',
  reseller: 'Revenda',
  kiwify: 'Kiwify',
  system: 'Sistema',
}

export function statusLabel(status: string) {
  return STATUS_LABELS[status] || status
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role] || role
}

export function sourceLabel(source: string | null | undefined) {
  if (!source) return '—'
  return SOURCE_LABELS[source] || source
}
