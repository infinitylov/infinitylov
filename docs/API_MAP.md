# InfinityLov — Mapa de APIs (Edge Functions)

**Projeto:** `saxxqxkhyakqvfcjbkqa`  
**Base:** `https://saxxqxkhyakqvfcjbkqa.supabase.co/functions/v1`  
**Auditoria:** [BACKEND_AUDIT.md](./BACKEND_AUDIT.md) — backend apto para frontend (2026-08-05)

---

## Extensão

| Function | JWT | Status | Uso |
|----------|-----|--------|-----|
| `validate-license` | off | OK | Login / polling extensão |
| `inject-config` | off | OK | Config + validação background |
| `send-lovable-prompt` | off | OK | Envio → Lovable `/chat` |
| `lov5` | off | OK | Transform content script |
| `get-support-info` | off | OK | WhatsApp / suporte |
| `get-templates` | off | OK | Stub `[]` (compat sidepanel) |

---

## Web / negócio

| Function | JWT | Status | Uso |
|----------|-----|--------|-----|
| `activate-license` | off | OK | `/ativar-licenca`: unused → active + user (só e-mail; sem session) |
| `admin-reset-device` | on | OK | Zera HWID (admin/support) |
| `admin-revoke-license` | on | OK | Revoga chave (admin) |
| `admin-grant-reseller` | on | OK | Promove user + créditos (admin) |
| `reseller-generate-licenses` | on | OK | Gera lote qty × dias; debita créditos |
| `kiwify-webhook` | off + token Kiwify | OK | Provisiona/renew/late/cancel; auth via `signature` HMAC-SHA1 |

### Contratos rápidos

**`activate-license`**
```json
{ "license_key": "INLO-…", "email": "a@b.com" }
```
Resposta: `{ ok, activated, expires_at, license_key, message }` (sem session).
**`admin-grant-reseller`**
```json
{ "email": "rev@x.com", "credits": 50, "notes": "PIX 04/08" }
```
ou `{ "user_id": "uuid", "credits": 50 }`

**`reseller-generate-licenses`**
```json
{ "quantity": 10, "duration_days": 30, "label": "lote-ago" }
```

**`kiwify-webhook`**
- URL na Kiwify (sem secret — a Kiwify usa o Token para assinar):
  `https://saxxqxkhyakqvfcjbkqa.supabase.co/functions/v1/kiwify-webhook`
- Token do painel (`1qj3w4orb4q`) = secret `KIWIFY_WEBHOOK_SECRET` no Supabase
- Auth: query `signature` = HMAC-SHA1(body, token)
- Marque na Kiwify: Compra aprovada + **Reembolso** + **Chargeback** (+ renovação/atraso se tiver)
- Idempotência em `webhook_events (provider, event_id)`

**`storage-upload`** — ainda não deployada (P2; bucket `extension-uploads` já existe)

---

## O que NÃO precisa de Edge Function

| Capacidade | Como |
|------------|------|
| CRUD módulos/aulas | Supabase client + RLS (admin) |
| Listar catálogo membros | Supabase client + RLS (entitlement) |
| Progresso de aulas | Supabase client + RLS |
| Login e-mail/senha | Supabase Auth direto |
| Perfil / Minha conta | Query `licenses` + `subscriptions` via RLS |
| Upload banner módulo | Storage `module-banners` + RLS admin |

---

## Storage

| Bucket | Público | Uso |
|--------|---------|-----|
| `module-banners` | sim | Capas de módulos (admin write) |
| `extension-uploads` | não | Anexos extensão (só service_role / futura EF) |

---

Ver também: [ARCHITECTURE.md](./ARCHITECTURE.md) · [SPEC.md](./SPEC.md) · [BACKEND_AUDIT.md](./BACKEND_AUDIT.md)
