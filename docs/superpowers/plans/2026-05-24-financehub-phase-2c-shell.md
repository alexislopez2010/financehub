# Phase 2C — App shell + bottom tabs + spotlight bar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the placeholder authenticated home with the real navigation skeleton — a bottom-tab nav (mobile) / top-tab nav (desktop), an always-visible spotlight search bar at the top, and 5 surface routes (`/`=Briefing, `/ledger`, `/plan`, `/bills`, `/accounts`) wired up with placeholder content. After 2C the structural shell is complete; subsequent sub-phases (2F–2J) fill each surface with real data.

**Architecture:** `(app)/layout.tsx` wraps every surface with `<TopBar>` (Lopez masthead · `<SpotlightBar>` · `<ProfileMenu>`) and `<TabBar>` (bottom on mobile, integrated into the top header on desktop). Spotlight is a Radix `<Dialog>` triggered by Cmd/Ctrl-K or clicking the search input; it hosts a `cmdk`-driven command palette with two modes for Phase 2C — **Jump** (navigate to surfaces) and a stub for **Find** (data wiring in 2E+). Active-tab highlighting derived from `usePathname()`.

**Tech Stack:** `@radix-ui/react-dialog`, `cmdk`, `lucide-react` (icons), Next.js App Router pathname, the editorial primitives from 2A.

---

## File structure (target end-state of 2C)

```
apps/web/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx              # rebuilt: TopBar + TabBar + profile
│   │   ├── page.tsx                # Briefing (placeholder, real in 2F)
│   │   ├── ledger/page.tsx         # placeholder
│   │   ├── plan/page.tsx           # placeholder
│   │   ├── bills/page.tsx          # placeholder
│   │   └── accounts/page.tsx       # placeholder
├── components/
│   ├── nav/
│   │   ├── TabBar.tsx              # 5-tab nav (bottom mobile, header desktop)
│   │   ├── TabBar.test.tsx
│   │   └── tabs.ts                 # tab metadata (path, label, icon, key)
│   └── spotlight/
│       ├── SpotlightBar.tsx        # the always-visible search input + ⌘K hint
│       ├── SpotlightDialog.tsx     # cmdk command palette inside Radix Dialog
│       ├── SpotlightProvider.tsx   # context: open/close + global keyboard listener
│       └── *.test.tsx
└── tests/
    └── shell.spec.ts               # Playwright: tab nav + spotlight open/close
```

---

## Task list

| # | Task | Files touched |
|---|---|---|
| 1 | Install `@radix-ui/react-dialog`, `cmdk`, `lucide-react`. Create the 5 placeholder surface pages (Briefing at `/`, plus `/ledger`, `/plan`, `/bills`, `/accounts`). Each uses `<Headline>` + `<SectionLabel>` to identify itself. | `apps/web/app/(app)/*/page.tsx` |
| 2 | Build `TabBar` component + `tabs.ts` metadata. Mobile: fixed bottom, 5 tabs with icon + label. Desktop (≥768px): horizontal tabs integrated into the header band, no bottom bar. Active tab gets `text-ink + border-b-ink`; inactive stays muted. Vitest: renders, highlights active, navigates on click. | `apps/web/components/nav/*` |
| 3 | Build `SpotlightProvider` (context + keyboard listener) and `SpotlightBar` (always-visible search input with Cmd-K hint). The bar is a button that opens the dialog. Tests for provider open/close + Cmd-K shortcut. | `apps/web/components/spotlight/SpotlightBar.tsx`, `SpotlightProvider.tsx` + tests |
| 4 | Build `SpotlightDialog` using Radix `<Dialog>` + `cmdk`. Two sections: **Jump** (5 surface entries) and **Find — coming soon** (placeholder, real wiring in 2E). Esc closes. Selecting a jump item navigates + closes. Tests cover open, jump-navigate, Esc-close. | `apps/web/components/spotlight/SpotlightDialog.tsx` + tests |
| 5 | Rebuild `(app)/layout.tsx` to compose `<SpotlightProvider>` + `<TopBar>` (masthead, spotlight bar, profile menu) + `<TabBar>` + `<main>` with appropriate bottom padding on mobile (so fixed bottom nav doesn't cover content). Rebuild `(app)/page.tsx` so it stays as the Briefing placeholder (don't remove — Briefing is `/`). | `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/page.tsx` |
| 6 | Playwright shell test: navigates between all 5 surfaces via tab clicks (asserts URL + active state); opens spotlight via Cmd-K; spotlight jump item navigates correctly. | `apps/web/tests/shell.spec.ts` |

---

## Success criteria

- Logged-in user lands on `/` (Briefing) — see the placeholder content + the new shell
- Bottom tab bar visible on mobile; horizontal tabs in the header on desktop
- Active tab visually distinct
- Cmd-K (or Ctrl-K) opens the spotlight dialog from any surface
- Spotlight "Jump" entries navigate to the correct routes and close the dialog
- Esc closes the dialog
- All existing Vitest + Playwright tests still pass (69 + 7) plus new tests for 2C

---

## Out of scope (later)

- Real data in any surface (2F–2J)
- Find mode actually searching transactions/bills/accounts (2E + 2K)
- Ask mode (Phase 4)
- Admin tab in the profile menu (2L — Admin is hidden behind profile, not in the tab bar)
