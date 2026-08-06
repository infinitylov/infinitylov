# InfinityLov

Monorepo da plataforma **InfinityLov** — área de membros, admin, revendedores, extensão Chrome e billing (Kiwify + licenças).

## Documentação (começar aqui)

| Documento | Conteúdo |
|-----------|----------|
| [docs/SPEC.md](./docs/SPEC.md) | Modelo de negócio, roles, licenças, revenda, auth, schema, fases |
| [docs/API_MAP.md](./docs/API_MAP.md) | Mapa de Edge Functions (prontas vs a criar) |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Backend, licença, extensão → Lovable |
| [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md) | Tokens, tipografia, layout, componentes de marca |
| [brand/](./brand/) | Icon, banner, logo oficiais |

## Estrutura

```
infinitylov/
├── apps/
│   ├── web/           # React + Vite (login / ativar / membros)
│   └── extension/     # Chrome InfinityLov → Edge Functions
├── packages/
│   └── ui/            # Tokens e componentes compartilhados
├── brand/             # Assets oficiais
├── supabase/
│   ├── migrations/
│   └── functions/
└── docs/
    ├── SPEC.md
    ├── ARCHITECTURE.md
    └── DESIGN_SYSTEM.md
```

## Decisões-chave (resumo)

- Conta/licença única → membros + extensão
- Licença de revenda: tempo começa **na ativação**
- Login: e-mail/senha **ou** ativar licença
- Plano 1 (Kiwify): 30 dias, libera tudo
- Revendedores: PIX fora + créditos manuais + CRUD de lotes
- Stack: Supabase (Auth/DB/Edge) + React na VPS
- Extensão fala só com Edge Functions; transform + proxy Lovable no servidor
- UI: dark neon (laranja → pink → roxo)

## Status

- Docs: SPEC + ARCHITECTURE + DESIGN_SYSTEM
- **Extensão + Edge Functions**: deployadas no projeto Supabase `infinitylov` (`saxxqxkhyakqvfcjbkqa`)
- Licença demo: `INLOA-TEST1-LOCAL-DEMO1`
- Zip: `InfinityLov-ext.zip`

## Legado

- `../lov3.4` — protótipo antigo (substituído por `apps/extension`)
- `../license-server` — FastAPI local (substituído pelas Edge Functions)
- `../DESIGN_SYSTEM.md` — Keve B2B (só referência estrutural; **não** usar paleta)
