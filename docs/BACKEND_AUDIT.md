# InfinityLov — Auditoria Backend (pré-frontend)

**Data:** 2026-08-05  
**Projeto:** `saxxqxkhyakqvfcjbkqa` (sa-east-1)  
**Veredito:** **APTO para frontend** (membros + admin + reseller). Itens P2/P3 e Kiwify secret ficam para go-live comercial.

---

## 1. O que foi auditado

| Área | Resultado |
|------|-----------|
| Schema Postgres + RLS | Hardening aplicado |
| Advisors Security | Críticos resolvidos |
| Advisors Performance | FKs indexadas; policies SELECT sem duplicata |
| Edge Functions | 12 ativas; auth staff unificada |
| Storage | Buckets `module-banners` (público) + `extension-uploads` (privado) |
| Secrets | `KIWIFY_WEBHOOK_SECRET` = token Kiwify (`1qj3w4orb4q`) — webhook testado OK |

---

## 2. Vulnerabilidades corrigidas nesta auditoria

### Crítico — escalada de privilégio em `profiles.role`
- **Antes:** policy `profiles_update_own` permitia UPDATE da própria row incluindo `role`.
- **Depois:** trigger `private.protect_profile_role` bloqueia mudança de `role` salvo `super_admin`/`admin`.

### Crítico — helpers `SECURITY DEFINER` no schema `public`
- **Antes:** `current_role`, `is_staff`, `has_active_entitlement` callable via Data API por `anon`.
- **Depois:** movidos para schema `private` (não exposto na API); grants só `authenticated`/`service_role`.
- `handle_new_user` e `license_hash` revogados de `anon`.

### Alto — RLS initplan + policies permissivas duplicadas
- Policies reescritas com `(select auth.uid())`.
- Policies de escrita (`FOR ALL`) separadas em INSERT/UPDATE/DELETE para não duplicar SELECT.

### Médio — e-mail case-sensitive na ativação
- `activate-license` e lookups usam `ilike`; índice único `profiles_email_unique_idx` em `lower(email)`.

### Médio — FKs sem índice
- Índices criados em `lesson_progress.lesson_id`, `licenses.(plan_id|batch_id|reseller_id)`, `license_batches.(created_by|reseller_id)`, `subscriptions.plan_id`, `lessons.module_id`.

---

## 3. Edge Functions (estado atual)

| Function | JWT | Auth app | Status |
|----------|-----|----------|--------|
| `validate-license` | off | license key | OK |
| `inject-config` | off | license key | OK |
| `send-lovable-prompt` | off | license key | OK |
| `lov5` | off | license key | OK |
| `get-support-info` | off | público | OK |
| `get-templates` | off | key opcional | OK (stub `[]`) |
| `activate-license` | off | público + key unused | OK |
| `admin-reset-device` | on | admin/support | OK |
| `admin-revoke-license` | on | admin | OK |
| `admin-grant-reseller` | on | admin | **NOVO** |
| `reseller-generate-licenses` | on | reseller/admin | OK |
| `kiwify-webhook` | off | signature HMAC + token | OK (compra/refund/chargeback testados) |

Shared: `_shared/{cors,license,transform,auth}.ts`

---

## 4. O que o frontend pode consumir agora (sem EF extra)

Via Supabase JS + sessão JWT + RLS:

- **Membros:** listar `modules`/`lessons` publicados (com entitlement); `lesson_progress` CRUD próprio; ler própria `licenses`/`subscriptions`/`profiles`
- **Admin:** CRUD `modules`/`lessons`/`plans`; ler `webhook_events`, `licenses`, `resellers`; upload banners em Storage `module-banners`
- **Reseller:** ler próprios lotes/licenças; gerar via `reseller-generate-licenses`

Via Edge:

- Login pós-ativação: `POST /activate-license`
- Reset HWID / revoke / grant reseller / generate licenses

---

## 5. Pendências explícitas (não bloqueiam shell do front)

| Item | Prioridade | Notas |
|------|------------|-------|
| Mapear `plans.kiwify_product_id` real | P1 go-live | Produto InfinityLov no painel |
| Habilitar **Leaked Password Protection** no Auth | P1 | Advisor WARN — só no Dashboard |
| `storage-upload` para anexos da extensão | P2 | Bucket já existe |
| Rate limit por IP/key nas EFs públicas | P2 | |
| Domínio / SMTP / LGPD | P2 produto | |
| Magic link e-mail de fato enviado ao comprador | P2 | `generateLink` best-effort; precisa SMTP |

---

## 6. Checklist de segurança residual (aceitável no MVP)

- `extension_config`: RLS on, **zero** policies → só `service_role` (intencional)
- Extensão EFs com `verify_jwt=false`: autenticam pela **license key** no body (padrão Chrome)
- `service_role` só dentro das Edge Functions
- CORS `*` (revisar para domínio web em produção)

---

## 7. Smoke sugerido antes do primeiro merge de UI

1. Ativar chave `unused` em `/ativar-licenca` → session JWT
2. Como member: SELECT modules published (vazio ok)
3. Promover user a admin no SQL/`profiles` (staff) → CRUD módulo
4. `admin-grant-reseller` → créditos → `reseller-generate-licenses`
5. Extensão: `validate-license` com key ativa

---

## 8. Green light frontend

**Sim — partir para o frontend.** Escopo recomendado nesta ordem:

1. Auth shell (`/login`, `/ativar-licenca`, guards por role)
2. Área membros (catálogo + player embed + progresso)
3. Admin conteúdo (módulos/aulas + upload banner)
4. Admin licenças (reset/revoke) + reseller panel
5. Integrar Kiwify secret + testes de webhook

Ver: [API_MAP.md](./API_MAP.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)
