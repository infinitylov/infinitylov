# Design System — InfinityLov

Sistema de design da plataforma InfinityLov (área de membros, admin, revendedor, extensão).

**Versão:** 1.0  
**Data:** 2026-08-05  
**Tema default:** Dark  
**Spec de produto:** [SPEC.md](./SPEC.md)

> O arquivo legado `DESIGN_SYSTEM.md` (Keve B2B, navy/azul) na raiz do workspace serve **apenas** como referência de estrutura (sidebar, spacing scale, a11y). **Não** usar a paleta Keve neste produto.

---

## 1. Stack de UI

```json
{
  "framework": { "react": "^18.3", "vite": "^5", "typescript": "^5" },
  "styling": { "tailwindcss": "^3.4", "tailwindcss-animate": "latest" },
  "components": { "shadcn-ui": "Radix", "lucide-react": "latest" },
  "routing": "react-router-dom ^6",
  "state": "@tanstack/react-query ^5",
  "theme": "next-themes (dark default)",
  "forms": "react-hook-form + zod",
  "animations": "framer-motion"
}
```

---

## 2. Identidade e assets

### 2.1 Arquivos oficiais

| Asset | Path | Uso |
|-------|------|-----|
| Icon | `brand/icon.png` | Favicon 32/180, PWA, `icons/*` da extensão (squircle ∞ + coração) |
| Banner | `brand/banner-membros.png` | Hero área de membros, header visual da extensão (16:9) |
| Logo | `brand/logo.png` | Sidebar, login, admin, e-mails (∞ + wordmark) |

### 2.2 Wordmark

- **Infinity** — branco sólido (`#FFFFFF`), weight 700–800
- **Lov** — gradiente magenta → roxo (`background-clip: text`)
- Sublinhado sutil laranja→roxo sob o “I” (opcional, só em hero)

### 2.3 Tom visual

- Dark near-black com bloom neon
- Gradiente de marca: **laranja → pink → roxo**
- Glass / glow só em brand marks e CTAs — não em tabelas admin densas
- Pill “ÁREA DE MEMBROS”: outline roxo, caps, tracking alto

---

## 3. Paleta (tokens CSS)

```css
:root,
.dark {
  /* Surfaces */
  --background: 260 40% 3%;           /* #05010D */
  --foreground: 0 0% 98%;
  --card: 260 30% 7%;
  --card-foreground: 0 0% 98%;
  --popover: 260 30% 8%;
  --popover-foreground: 0 0% 98%;
  --muted: 260 20% 12%;
  --muted-foreground: 260 10% 65%;
  --border: 270 25% 18%;
  --input: 270 25% 12%;
  --ring: 300 100% 55%;

  /* Brand stops */
  --brand-orange: 28 100% 55%;        /* ~#FF8A1A */
  --brand-pink: 320 100% 50%;         /* ~#FF008C */
  --brand-magenta: 300 100% 55%;
  --brand-purple: 270 100% 55%;       /* ~#7000FF */
  --brand-violet: 265 80% 45%;

  /* Semantic */
  --primary: 300 90% 55%;
  --primary-foreground: 0 0% 100%;
  --secondary: 260 20% 14%;
  --secondary-foreground: 0 0% 96%;
  --accent: 28 100% 55%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 55%;
  --destructive-foreground: 0 0% 100%;
  --success: 142 70% 40%;
  --warning: 38 92% 50%;
  --info: 199 89% 48%;

  /* Sidebar */
  --sidebar-background: 260 35% 5%;
  --sidebar-foreground: 0 0% 96%;
  --sidebar-primary: 300 90% 55%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 300 90% 55% / 0.12;
  --sidebar-accent-foreground: 300 90% 70%;
  --sidebar-border: 270 25% 16%;
  --sidebar-ring: 300 100% 55%;

  --radius: 1rem;

  --gradient-brand: linear-gradient(90deg, #FF8A1A 0%, #FF008C 45%, #7000FF 100%);
  --glow-pink: 0 0 24px rgba(255, 0, 140, 0.45);
  --glow-purple: 0 0 28px rgba(112, 0, 255, 0.35);

  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 3.1 Hex de referência rápida

| Token | Hex | Uso |
|-------|-----|-----|
| background | `#05010D` | Fundo app |
| brand-orange | `#FF8A1A` | Início do gradiente / accent quente |
| brand-pink | `#FF008C` | “Lov”, coração, glow |
| brand-purple | `#7000FF` | Fim do gradiente, pills, focus |
| foreground | `#FAFAFA` | Texto principal |
| border | `hsl(270 25% 18%)` | Divisores |

### 3.2 Uso no Tailwind

```tsx
// Correto — tokens semânticos
<div className="bg-background text-foreground">
<button className="bg-primary text-primary-foreground">
<section className="bg-card border border-border rounded-2xl">

// CTA com gradiente de marca
<button
  className="rounded-xl text-white font-semibold"
  style={{ background: "var(--gradient-brand)", boxShadow: "var(--glow-pink)" }}
>
  Ativar licença
</button>

// Errado — hardcoded Keve / genéricos
<div className="bg-blue-600"> // não
<div className="bg-[#0D1F4D]"> // navy Keve — não
```

---

## 4. Tipografia

- Família preferida: **Plus Jakarta Sans** ou **Outfit** (Google Fonts)
- Evitar Inter / Roboto / Arial como display
- Escala sugerida:

| Token | Size | Weight | Uso |
|-------|------|--------|-----|
| `display` | 36–48px | 800 | Hero / login brand |
| `h1` | 28–32px | 700 | Títulos de página |
| `h2` | 22–24px | 650 | Seções |
| `body` | 14–16px | 400–500 | Texto |
| `caption` | 12px | 500 | Meta, pills (tracking largo) |

Wordmark CSS:

```css
.brand-lov {
  background: var(--gradient-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

---

## 5. Espaçamento e radius

- Base 4px; preferir escala Tailwind (`2, 3, 4, 6, 8, 10, 12, 16`)
- `--radius: 1rem` (16px) em cards e inputs
- Botões: `rounded-xl` (12px)
- Pills: `rounded-full`
- Icon app: squircle (alto radius, ~22% do lado)

---

## 6. Layout

### 6.1 Shell autenticado (membros / admin / revendedor)

- **Desktop:** sidebar esquerda (`--sidebar-background`) + header + main
- **Mobile:** header + bottom navigation
- Largura conteúdo: `max-w-6xl` / `max-w-7xl` conforme densidade
- Safe areas iOS: `env(safe-area-inset-*)`

### 6.2 Login / ativar licença

- Fundo `#05010D` + glow sutil
- Card central com logo
- Banner de marca opcional acima do form (desktop)
- Dois caminhos claros: Entrar | Ativar licença

### 6.3 Catálogo de módulos

- Grid responsivo de **covers verticais** (aspect sugerido `2/3`)
- Card: imagem full-bleed no topo, título curto, sem clutter
- Hover: leve scale + glow pink discreto

### 6.4 Admin / revendedor

- Tabelas densas, glow mínimo
- Filtros + busca no header da seção
- CTAs de geração de licença usam `--gradient-brand`

---

## 7. Componentes de marca

| Componente | Responsabilidade |
|------------|------------------|
| `BrandLogo` | PNG logo ou wordmark tipográfico |
| `BrandIcon` | Squircle icon |
| `MembersHeroBanner` | Banner horizontal oficial |
| `MembersPill` | Badge “ÁREA DE MEMBROS” |
| `ModuleCover` | Cover vertical do módulo (upload) |
| `GradientButton` | CTA primário com gradiente + glow |
| `LicenseKeyField` | Input/mascara `INLO-…` + copiar |

### 7.1 Botões

- **Primário (gradiente):** ações comerciais (ativar, gerar, assinar)
- **Primary sólido (`--primary`):** ações padrão (salvar, continuar)
- **Secondary / ghost:** cancelar, secundário
- **Destructive:** revogar, excluir

---

## 8. Motion

- Entrada de página: fade + slight y (150–250ms)
- Hover de ModuleCover: scale 1.02 + glow
- Toast de sucesso: slide suave
- Evitar partículas/neon animado contínuo em telas densas

Mínimo: **2–3 motions intencionais** nas superfícies de marca (login, hero membros).

---

## 9. Acessibilidade

- Contraste texto/fundo WCAG AA no dark
- Focus ring = `--ring` (magenta)
- Não depender só de cor para status de licença (ícone + label)
- Botões com `aria-label` em ícones-only
- Formulários com labels visíveis

---

## 10. Z-index (escala)

| Camada | Z |
|--------|---|
| Conteúdo | 0 |
| Sticky header | 30 |
| Sidebar / bottom nav | 40 |
| Dropdown | 50 |
| Modal / sheet | 60 |
| Toast | 70 |

---

## 11. Extensão Chrome

- Icon: derivados de `brand/icon.png` (16/32/48/128)
- Sidepanel: logo + `banner-membros` compacto
- Mesmos tokens de cor (CSS variables no sidepanel)
- Nome exibido: **InfinityLov**

---

## 12. Light theme

**Fora do MVP.** Se necessário depois: superfícies claras com gradiente de marca só em CTAs; fundo nunca “cream genérico”.

---

## 13. Checklist de implementação

- [ ] Tokens no `index.css` / Tailwind theme extend
- [ ] Fontes Plus Jakarta Sans / Outfit
- [ ] Componentes Brand* em `packages/ui`
- [ ] Login + Ativar licença no visual dark
- [ ] Hero membros com banner oficial
- [ ] Grid ModuleCover vertical
- [ ] Extensão rebrandada com icon/logo
