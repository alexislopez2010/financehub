# Phase 2A — Scaffold + Design System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 + TypeScript monorepo, land the editorial design system tokens + primitives, and wire CI (Vitest + Playwright + tsc + eslint) — without disturbing the legacy Vite app.

**Architecture:** Greenfield branch `phase-2-rewrite`. Repo becomes a monorepo via npm workspaces. The current Vite app moves to `apps/legacy/`. New Next.js 15 (App Router, React 19, TypeScript strict) app lives at `apps/web/`. Tailwind v3 + CSS custom properties for tokens. Radix primitives (Dialog, Popover, Combobox, Toast) as the accessibility layer. Editorial primitives hand-rolled per the spec. Tests colocated (`*.test.ts`). CI gates merges.

**Tech Stack:** Next.js 15.x · React 19 · TypeScript 5.x (strict) · Tailwind CSS 3.x · Radix UI · Vitest · Playwright · ESLint flat config · GitHub Actions · Supabase JS client (shared with legacy).

---

## File structure (target end-state of 2A)

```
financehub/
├── apps/
│   ├── legacy/                   # moved-here Vite app
│   │   ├── src/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   └── .env.example
│   └── web/                      # new Next.js 15 app
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx          # placeholder home
│       │   ├── design-system/
│       │   │   └── page.tsx      # primitives showcase
│       │   └── globals.css       # design tokens
│       ├── components/
│       │   └── ui/
│       │       ├── Masthead.tsx
│       │       ├── Headline.tsx
│       │       ├── Standfirst.tsx
│       │       ├── SectionLabel.tsx
│       │       ├── KpiStone.tsx
│       │       └── RulerList.tsx
│       ├── lib/
│       │   └── cn.ts             # className util
│       ├── public/
│       ├── tests/
│       │   └── smoke.spec.ts     # one initial Playwright test
│       ├── eslint.config.mjs
│       ├── next.config.ts
│       ├── package.json
│       ├── playwright.config.ts
│       ├── postcss.config.mjs
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       └── vitest.config.ts
├── supabase/                     # unchanged — shared by both apps
├── docs/                         # unchanged
├── .github/
│   └── workflows/
│       └── ci.yml                # tsc, lint, vitest, playwright
├── package.json                  # NEW — workspaces root
├── tsconfig.base.json            # NEW — shared compiler options
└── README.md                     # updated for monorepo
```

---

## Task list

| # | Task | Files touched |
|---|---|---|
| 1 | Cut `phase-2-rewrite` branch from `main` | git |
| 2 | Move Vite app: `src/` + configs → `apps/legacy/`; verify legacy still builds | `apps/legacy/**`, `package.json` |
| 3 | Create root `package.json` with workspaces + `tsconfig.base.json` | `package.json`, `tsconfig.base.json` |
| 4 | Bootstrap Next.js 15 in `apps/web/` with TS strict | `apps/web/**` |
| 5 | Wire Tailwind v3 + design tokens (paper/ink/muted/rule/accent/warn in OKLCH; tabular-nums; system sans) | `apps/web/app/globals.css`, `apps/web/tailwind.config.ts` |
| 6 | Add Radix peer deps + `cn` helper + `<Dialog>`, `<Popover>`, `<Toast>`, `<Combobox>` thin wrappers | `apps/web/components/ui/*`, `apps/web/lib/cn.ts` |
| 7 | Build editorial primitives with Vitest tests: `Masthead`, `Headline`, `Standfirst`, `SectionLabel`, `KpiStone`, `RulerList` | `apps/web/components/ui/*` + colocated `*.test.tsx` |
| 8 | Build `/design-system` showcase page rendering every primitive at mobile + desktop widths | `apps/web/app/design-system/page.tsx` |
| 9 | Configure Vitest (jsdom env, @testing-library/react) + write a single passing component test to prove the pipeline | `apps/web/vitest.config.ts`, `apps/web/package.json` |
| 10 | Configure Playwright (Chromium baseline) + one smoke test hitting `/design-system` and asserting the masthead renders | `apps/web/playwright.config.ts`, `apps/web/tests/smoke.spec.ts` |
| 11 | Flat-config ESLint + Next.js plugin + tsc-typed lint | `apps/web/eslint.config.mjs` |
| 12 | GitHub Actions CI: jobs for tsc, lint, vitest, playwright (artifact on fail) | `.github/workflows/ci.yml` |
| 13 | Update root `README.md` for monorepo workflow; final commit + green CI | `README.md` |

---

## Success criteria

- `npm install` at the repo root installs both apps' deps via workspaces.
- `npm run dev -w apps/legacy` boots the Vite app at `:5173` and serves the existing Lopez dashboard against prod Supabase — unchanged from `main`.
- `npm run dev -w apps/web` boots Next.js at `:3000` and serves `/design-system` showing every editorial primitive against real data shapes.
- All four CI jobs pass on the `phase-2-rewrite` branch.
- `git diff main..phase-2-rewrite -- supabase/ docs/` is empty (the DB and docs are not touched in 2A).
- The Vercel preview deployment of `phase-2-rewrite` builds successfully (legacy app is the entry point; the Next.js app is in `apps/web/` but the Vercel root remains the legacy app until Phase 2O cutover).

---

## What 2A explicitly does NOT include (handled by later sub-phases)

- Auth flow + middleware (2B)
- App shell with bottom-tabs and spotlight bar wiring (2C)
- The 5 surfaces' actual content (2F–2J)
- `lib/finance/*` modules (2D)
- TanStack Query (2E)
- Admin (2L)
- pgTAP schema tests (2M)
- Cleanup migrations (2N)
- Cutover (2O)

When 2A is green and reviewed, write the 2B plan and continue.
