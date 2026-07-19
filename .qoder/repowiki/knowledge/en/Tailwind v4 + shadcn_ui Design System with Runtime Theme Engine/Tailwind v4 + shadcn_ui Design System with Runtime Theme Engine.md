---
kind: frontend_style
name: Tailwind v4 + shadcn/ui Design System with Runtime Theme Engine
category: frontend_style
scope:
    - '**'
source_files:
    - src/app/globals.css
    - components.json
    - postcss.config.mjs
    - src/contexts/ThemeContext.tsx
    - src/components/ThemeCustomizer.tsx
    - src/components/ui/button.tsx
    - src/lib/utils.ts
---

The SLT ERP frontend uses a layered styling system built on Tailwind CSS v4, the shadcn/ui component library (New York style), and a runtime theme engine that lets users switch between light/dark modes and multiple accent colors.

Core stack
- Tailwind CSS v4 via @tailwindcss/postcss (no legacy tailwind.config.js; configuration lives in src/app/globals.css).
- shadcn/ui components under src/components/ui/*, configured through components.json (style: new-york, base color neutral, CSS variables enabled).
- Radix UI primitives (@radix-ui/react-*) for unstyled, accessible building blocks.
- class-variance-authority + clsx + tailwind-merge for variant-driven class composition (cn() utility in src/lib/utils.ts).
- tw-animate-css for micro-interactions; lucide-react for icons.

Design tokens & theming
- Global tokens are declared as CSS custom properties in src/app/globals.css using both rgb(var(...)) and oklch(...) forms, covering primary/foreground/background/card/border/ring/chart/sidebar families plus radius scale (--radius-sm ... --radius-4xl).
- A @theme inline block maps the RGB token set to Tailwind's semantic color names so every shadcn component picks up brand values automatically.
- Dark mode is driven by a .dark root class plus a parallel body.dark-mode selector used by the runtime engine; overrides force common slate classes into token values.
- A custom ThemeContext (src/contexts/ThemeContext.tsx) persists colorTheme (blue/green/purple/orange/red/darkblue/ash/teal/cyan/indigo/pink) and mode (light/dark) in localStorage, then writes --color-primary, --color-background, --color-sidebar, etc. directly onto document.documentElement.
- A floating ThemeCustomizer popover (src/components/ThemeCustomizer.tsx) exposes next-themes' light/dark/system toggle plus six preset primary swatches, also persisted to localStorage.

Component conventions
- All shared UI primitives live in src/components/ui/ (button, dialog, table, badge, card, form, select, tabs, calendar, skeleton, progress, separator, dropdown-menu, command, alert-dialog, input, label, textarea, scroll-area, switch, checkbox, popover, accordion). They follow shadcn patterns: data-slot/data-variant/data-size attributes, CVA variants, and cn() merging.
- Business components sit alongside pages under src/components/<domain>/ (projects, gis, helpdesk, modals, dashboard) and compose the ui primitives rather than writing raw CSS.
- Page-level visual polish is centralized in globals.css: compact enterprise tables (sticky headers, 10–11 px type, 32 px row height), glass-panel panels, and global spacing reductions to maximize data density.

CSS methodology
- No SCSS/Sass — pure CSS + Tailwind utilities.
- Custom utility classes (e.g., .glass-panel, .erp-page-wrapper, .erp-toolbar, .erp-table-container, .erp-status-badge) encapsulate recurring layout patterns not covered by Tailwind's defaults.
- Scrollbars are globally restyled for both webkit and Firefox, with dark-mode variants.

Responsive strategy
- Fully responsive via Tailwind's breakpoint utilities; no separate media-query files. The sidebar/header/layout components adapt through standard md:/lg: prefixes.

Rules developers should follow
1. Use shadcn/ui primitives from @/components/ui/* instead of hand-rolled inputs/buttons/dialogs.
2. Compose styles with cn() from @/lib/utils and CVA variants; avoid ad-hoc className strings when a variant already exists.
3. Reference design tokens exclusively through Tailwind semantic color names (bg-primary, text-muted-foreground, border-border, ring-ring) — never hard-code hex values.
4. When adding a new color theme or mode, update ThemeContext.tsx's colorThemes / modeColors maps and the matching CSS variable declarations in globals.css.
5. Keep page-specific overrides minimal; prefer extending the existing compact table/page-density rules in globals.css rather than duplicating selectors.
6. Persist user preferences only via localStorage keys already defined (colorTheme, mode, theme-primary); do not introduce new storage mechanisms.