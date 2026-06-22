# Bill Forecasting — Phase 2 (Forecast Surface) Implementation Plan

> Executed directly (tightly-coupled UI), with the pure glue module TDD'd and an independent review at the end.

**Goal:** A new `/forecast` tab that renders the Phase 1 engine — a horizon selector, a stacked-by-tier projection chart, three color-coded tier sections with per-bill detail + one-click tier override, and a propose-and-apply-to-budgets panel.

**Architecture:** One pure glue module (`buildProjectInputs`) maps DB rows → the engine's `ProjectBill[]` + discretionary categories. The engine (Phase 1) does the math. New data mutations write tier overrides and apply budgets. UI composes it. Color-coding is centralised in `tierTheme.ts`.

**Tech stack:** Next.js 15 App Router, TanStack Query, Tailwind, Recharts-free hand-rolled SVG (matches existing `ForecastChart`).

Reference: `docs/superpowers/specs/2026-06-21-bill-forecasting-design.md` (Phase 2 section).

## File structure

| File | Responsibility |
|---|---|
| `lib/forecast/tierTheme.ts` | Per-tier color tokens + labels (chart series, chip, accent) — single source |
| `lib/forecast/buildProjectInputs.ts` (+test) | Pure: bills+categories+txns → `{ bills: ProjectBill[], discretionaryCategories }` |
| `lib/data/forecastMutations.ts` | `useSetBillTier`, `useSetCategoryTier`, `useApplyBudgets` (upsert) |
| `app/(app)/forecast/page.tsx` | Server page → `<ForecastSection/>` |
| `components/forecast/ForecastSection.tsx` | Orchestrator: hooks, horizon state, compose project→rollup, render |
| `components/forecast/ForecastTierChart.tsx` | Stacked bar by tier across the horizon (SVG) |
| `components/forecast/TierGroup.tsx` | Collapsible color-coded tier section |
| `components/forecast/ForecastBillRow.tsx` | Per-line: name, tier chip (override), current vs projected, method badge |
| `components/forecast/ProposeBudgetsPanel.tsx` | Proposed vs current per category + Apply |
| `components/nav/tabs.ts` | Add the `forecast` tab |

## Tasks (build order)

1. `tierTheme.ts` — color tokens.
2. `buildProjectInputs.ts` + tests — the pure glue (TDD).
3. `forecastMutations.ts` — tier override + budget apply mutations.
4. Nav tab + `/forecast` route + `ForecastSection` skeleton (compose engine, render raw numbers) — verify it loads.
5. `ForecastTierChart` — stacked bar.
6. `TierGroup` + `ForecastBillRow` — tier sections with override.
7. `ProposeBudgetsPanel` — apply flow.
8. Verify: tsc + build + responsive sanity, then independent review.

## Key code — `buildProjectInputs.ts`

```ts
import type { Tables } from '@/lib/supabase/database.types'
import { resolveTier, isSpendTier, type SpendTier } from './tier'
import { parseSeasonalProfile } from './seasonalProfile'
import type { ProjectBill, DiscretionaryCategory } from './project'

type BillRow = Tables<'bills'>
type CategoryRow = Tables<'categories'>

export interface BuildProjectInputsArgs {
  bills: ReadonlyArray<BillRow>
  categories: ReadonlyArray<CategoryRow>
}

export interface ProjectInputs {
  bills: ReadonlyArray<ProjectBill>
  discretionaryCategories: ReadonlyArray<DiscretionaryCategory>
}

/**
 * Maps DB rows → the Phase 1 engine's inputs. Each active bill becomes a
 * ProjectBill with its tier resolved (bill override → category override →
 * auto) and its seasonal_profile parsed. Expense categories that resolve to
 * the discretionary tier AND have no bill become discretionary lines so the
 * engine can trend-project them.
 */
export function buildProjectInputs(args: BuildProjectInputsArgs): ProjectInputs {
  const catByName = new Map<string, CategoryRow>()
  const catById = new Map<string, CategoryRow>()
  for (const c of args.categories) {
    catByName.set(c.name.trim().toLowerCase(), c)
    catById.set(c.id, c)
  }

  const billedCategoryNames = new Set<string>()
  const bills: ProjectBill[] = []

  for (const b of args.bills) {
    if (b.is_active === false) continue
    const cat = b.category ? catByName.get(b.category.trim().toLowerCase()) : undefined
    const tier = resolveTier({
      billTier: isSpendTier(b.tier) ? b.tier : null,
      categoryTier: cat && isSpendTier(cat.tier) ? cat.tier : null,
      isFixed: cat?.is_fixed ?? null,
      hasLinkedDebt: b.linked_debt_id != null,
      hasBill: true
    })
    if (b.category) billedCategoryNames.add(b.category.trim().toLowerCase())
    bills.push({
      id: b.id,
      name: b.name,
      tier,
      category: b.category,
      budgetAmount: b.budget_amount,
      isFixed: cat?.is_fixed === true,
      seasonalProfile: parseSeasonalProfile(b.seasonal_profile)
    })
  }

  // Discretionary categories: expense categories that resolve to discretionary
  // and aren't already covered by a bill.
  const discretionaryCategories: DiscretionaryCategory[] = []
  for (const c of args.categories) {
    if (c.type !== 'expense') continue
    if (billedCategoryNames.has(c.name.trim().toLowerCase())) continue
    const tier = resolveTier({
      billTier: null,
      categoryTier: isSpendTier(c.tier) ? c.tier : null,
      isFixed: c.is_fixed ?? null,
      hasLinkedDebt: false,
      hasBill: false
    })
    if (tier === 'discretionary') discretionaryCategories.push({ name: c.name })
  }

  return { bills, discretionaryCategories }
}
```

Tests cover: tier resolution precedence flows through; inactive bills skipped; billed categories excluded from discretionary; seasonal_profile parsed; non-expense categories ignored.

## Key code — `tierTheme.ts`

```ts
import type { SpendTier } from './tier'

export interface TierTheme {
  label: string
  /** Tailwind text color for labels/accents. */
  text: string
  /** Tailwind bg for chips / chart fills. */
  fill: string
  /** Hex for SVG chart series. */
  hex: string
}

export const TIER_THEME: Record<SpendTier, TierTheme> = {
  essential:     { label: 'Essential',               text: 'text-blue-700',    fill: 'bg-blue-500',    hex: '#3b82f6' },
  services:      { label: 'Services & Subscriptions', text: 'text-amber-700',   fill: 'bg-amber-500',   hex: '#f59e0b' },
  discretionary: { label: 'Discretionary',           text: 'text-slate-700',   fill: 'bg-slate-500',   hex: '#64748b' }
}

export const TIER_ORDER: ReadonlyArray<SpendTier> = ['essential', 'services', 'discretionary']
```

## Data mutations — `forecastMutations.ts`

- `useSetBillTier()` → `bills.update({ tier }).eq('id', id)`; invalidate `queryKeys.bills()`.
- `useSetCategoryTier()` → `categories.update({ tier }).eq('id', id)`; invalidate `queryKeys.categories()`.
- `useApplyBudgets()` → for each `{category, amount, year, month}`: find existing budget row for (category, year, month); update if present else insert (resolve `category_id` from categories by name, write both `category` + `category_id`). Invalidate `queryKeys.budgets({year})`. Follow the create/update pattern already in `lib/data/budgets.ts`.

## UI specs

- **ForecastSection** — `useBills`, `useCategories`, `useTransactions`, `useBudgets({year})`, `useIncomePlan({year})`. Horizon state (6/12/24, default 12). `buildProjectInputs` → `project(...)` + `projectDiscretionary(...)` → concat → `rollupByTier`. Render: horizon selector, `ForecastTierChart`, three `TierGroup`s in `TIER_ORDER`, `ProposeBudgetsPanel` for next month.
- **ForecastTierChart** — SVG stacked bars, one bar per projected month, stacked essential→services→discretionary using `TIER_THEME[*].hex`. Month labels on x-axis; y-axis max from the tallest stacked total. Legend with the three tier colors. `overflow-x-auto` wrapper for narrow screens.
- **TierGroup** — header (color dot + `TIER_THEME[tier].label` + tier monthly total), collapsible, lists `ForecastBillRow`s for that tier.
- **ForecastBillRow** — name, clickable tier chip (cycles tier via `useSetBillTier`/`useSetCategoryTier`), `method` badge ('seasonal' / 'ledger' / 'flat' / 'trailing-avg'), current budget vs projected next-month amount. Discretionary `cat:` lines have no bill id → tier override writes the category tier.
- **ProposeBudgetsPanel** — `proposeBudgets(projections, currentBudgets, nextYear, nextMonth)`; table of proposed vs current vs delta; per-row + bulk **Apply** via `useApplyBudgets`. Reuse the `overflow-x-auto` + `min-w` responsive-table pattern.

## Testing

- `buildProjectInputs` — unit tests (the only heavy pure logic new here).
- Surface — tsc + `next build` green; responsive sanity at mobile width (scrollable chart/table).
- Final independent review over the whole Phase 2 diff.
