# InfinityLov — Extensão Chrome

Backend: **Supabase Edge Functions** (`https://saxxqxkhyakqvfcjbkqa.supabase.co/functions/v1`).

## Instalar

1. Chrome → `chrome://extensions` → Modo desenvolvedor → **Carregar sem empacotar**
2. Selecione esta pasta `apps/extension`
3. Licença demo: `INLOA-TEST1-LOCAL-DEMO1` (também `LOV3A-TEST1-LOCAL-DEMO1`)

Zip empacotado: `../../InfinityLov-ext.zip`

## Endpoints

| Function | Uso |
|----------|-----|
| `validate-license` | Login / polling |
| `inject-config` | Config + validação (background) |
| `send-lovable-prompt` | Envio sidepanel → Lovable `/chat` |
| `lov5` | Transform do content script |
| `get-support-info` | WhatsApp / suporte |

## Marca

Nome **InfinityLov** · assets de `brand/` (icon, banner, logo).
