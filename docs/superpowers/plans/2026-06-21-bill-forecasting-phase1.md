# Bill Forecasting — Phase 1 (Taxonomy + Projection Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, fully-tested data foundation for forecasting — a three-tier spend taxonomy and a per-bill monthly projection engine — with no AI and no UI surface yet.

**Architecture:** Additive schema (tier columns + a compact per-bill `seasonal_profile` jsonb). Pure, side-effect-free TypeScript modules under `apps/web/lib/forecast/` that take rows in and return projections out. Each module has one responsibility and is unit-tested in isolation at the `lib/finance` coverage bar.

**Tech Stack:** Next.js 15 / TypeScript (strict, exactOptionalPropertyTypes), Supabase Postgres, Vitest. Run all test/tsc commands from the repo root `/Users/alexis.lopez/Code/financehub` (the `vitest.workspace.ts` there resolves the `@/` alias).

Reference spec: `docs/superpowers/specs/2026-06-21-bill-forecasting-design.md`.

---

### Task 1: Schema — tier columns + seasonal_profile

**Files:**
- Create: `supabase/migrations/0029_forecast_tiers_and_profiles.sql`
- Modify: `apps/web/lib/supabase/database.types.ts` (categories Row/Insert/Update, bills Row/Insert/Update)

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/0029_forecast_tiers_and_profiles.sql`:

```sql
-- 0029_forecast_tiers_and_profiles.sql
-- Phase 3N (forecasting) — three-tier spend taxonomy + per-bill seasonal profile.
-- Additive + nullable; no breakage. tier resolution order is application-side
-- (bills.tier > categories.tier > auto-derived), so columns are advisory hints.

alter table categories
  add column if not exists tier text;
alter table categories
  drop constraint if exists categories_tier_check;
alter table categories
  add constraint categories_tier_check
  check (tier is null or tier in ('essential','services','discretionary'));

alter table bills
  add column if not exists tier text,
  add column if not exists seasonal_profile jsonb;
alter table bills
  drop constraint if exists bills_tier_check;
alter table bills
  add constraint bills_tier_check
  check (tier is null or tier in ('essential','services','discretionary'));
```

- [ ] **Step 2: Apply the migration to the database**

Apply via the Supabase MCP `apply_migration` tool (project id `euemewcdrdiloddlrywm`, name `forecast_tiers_and_profiles`) using the SQL body above. Expected: `{"success":true}`.

- [ ] **Step 3: Update the generated types by hand**

In `apps/web/lib/supabase/database.types.ts`, add to the `categories` table `Row`, `Insert`, and `Update` blocks:
- Row: `tier: string | null`
- Insert: `tier?: string | null`
- Update: `tier?: string | null`

And to the `bills` table `Row`, `Insert`, and `Update` blocks:
- Row: `tier: string | null` and `seasonal_profile: Json | null`
- Insert: `tier?: string | null` and `seasonal_profile?: Json | null`
- Update: `tier?: string | null` and `seasonal_profile?: Json | null`

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/alexis.lopez/Code/financehub/apps/web && pnpm tsc --noEmit --pretty false`
Expected: no output (clean).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add supabase/migrations/0029_forecast_tiers_and_profiles.sql apps/web/lib/supabase/database.types.ts
git commit -m "feat(forecast): add tier columns + bills.seasonal_profile schema"
```

---

### Task 2: Tier taxonomy — `resolveTier`

**Files:**
- Create: `apps/web/lib/forecast/tier.ts`
- Test: `apps/web/lib/forecast/tier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/forecast/tier.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { resolveTier, type ResolveTierInput } from './tier'

function input(over: Partial<ResolveTierInput> = {}): ResolveTierInput {
  return {
    billTier: null,
    categoryTier: null,
    isFixed: null,
    hasLinkedDebt: false,
    hasBill: false,
    ...over
  }
}

describe('resolveTier', () => {
  it('returns the explicit bill tier when set (highest precedence)', () => {
    expect(resolveTier(input({ billTier: 'essential', categoryTier: 'discretionary', isFixed: false }))).toBe('essential')
  })

  it('falls back to the category tier when no bill tier', () => {
    expect(resolveTier(input({ categoryTier: 'services', isFixed: true }))).toBe('services')
  })

  it('auto: fixed category is essential even with no bill (e.g. groceries)', () => {
    expect(resolveTier(input({ isFixed: true, hasBill: false }))).toBe('essential')
  })

  it('auto: a debt-linked bill is essential (mortgage, car) even if category is not fixed', () => {
    expect(resolveTier(input({ isFixed: false, hasLinkedDebt: true, hasBill: true }))).toBe('essential')
  })

  it('auto: a non-fixed, non-debt bill is services (subscriptions)', () => {
    expect(resolveTier(input({ isFixed: false, hasLinkedDebt: false, hasBill: true }))).toBe('services')
  })

  it('auto: non-fixed spend with no bill is discretionary (dining, shopping)', () => {
    expect(resolveTier(input({ isFixed: false, hasBill: false }))).toBe('discretionary')
  })

  it('auto: unknown is_fixed (null) with no bill is discretionary', () => {
    expect(resolveTier(input({ isFixed: null, hasBill: false }))).toBe('discretionary')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/tier.test.ts`
Expected: FAIL — "Failed to resolve import './tier'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/forecast/tier.ts`:

```ts
/**
 * Three-tier spend taxonomy.
 *
 *   essential      — non-negotiable floor: mortgage, car, insurance, utilities, groceries.
 *   services       — recurring but cancellable: subscriptions, memberships.
 *   discretionary  — variable non-committed spend: dining, shopping, entertainment.
 *
 * Resolution precedence (the Forecast surface lets the user override either level):
 *   1. bills.tier      (most specific)
 *   2. categories.tier
 *   3. auto-derived heuristic (below)
 */

export type SpendTier = 'essential' | 'services' | 'discretionary'

export interface ResolveTierInput {
  /** bills.tier override, or null. */
  billTier: SpendTier | null
  /** categories.tier override, or null. */
  categoryTier: SpendTier | null
  /** categories.is_fixed for the item's category. */
  isFixed: boolean | null
  /** True if the bill has linked_debt_id set (mortgage / car / loan obligation). */
  hasLinkedDebt: boolean
  /** True if this spend line corresponds to a named bill. */
  hasBill: boolean
}

export function resolveTier(input: ResolveTierInput): SpendTier {
  if (input.billTier) return input.billTier
  if (input.categoryTier) return input.categoryTier
  // Auto heuristic:
  if (input.isFixed === true) return 'essential'
  if (input.hasLinkedDebt) return 'essential'
  if (input.hasBill) return 'services'
  return 'discretionary'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/tier.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add apps/web/lib/forecast/tier.ts apps/web/lib/forecast/tier.test.ts
git commit -m "feat(forecast): resolveTier taxonomy with override precedence + auto heuristic"
```

---

### Task 3: Seasonal profile — type, safe parse, month lookup

**Files:**
- Create: `apps/web/lib/forecast/seasonalProfile.ts`
- Test: `apps/web/lib/forecast/seasonalProfile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/forecast/seasonalProfile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseSeasonalProfile, amountForMonth, type SeasonalProfile } from './seasonalProfile'

const valid: SeasonalProfile = {
  baseline: [180, 170, 140, 90, 60, 45, 40, 40, 55, 90, 130, 175],
  source: 'import',
  years: 3,
  computed_at: '2026-06-21',
  note: 'Winter peak Dec–Feb; 2024 ~8% over 2023.'
}

describe('parseSeasonalProfile', () => {
  it('parses a valid profile object', () => {
    expect(parseSeasonalProfile(valid)).toEqual(valid)
  })

  it('returns null for null / undefined', () => {
    expect(parseSeasonalProfile(null)).toBeNull()
    expect(parseSeasonalProfile(undefined)).toBeNull()
  })

  it('returns null when baseline is not length 12', () => {
    expect(parseSeasonalProfile({ ...valid, baseline: [1, 2, 3] })).toBeNull()
  })

  it('returns null when baseline contains a non-number', () => {
    const bad = { ...valid, baseline: [...valid.baseline.slice(0, 11), 'x'] }
    expect(parseSeasonalProfile(bad)).toBeNull()
  })

  it('returns null for a non-object', () => {
    expect(parseSeasonalProfile('nope')).toBeNull()
    expect(parseSeasonalProfile(42)).toBeNull()
  })
})

describe('amountForMonth', () => {
  it('returns the baseline for the 1-indexed month', () => {
    expect(amountForMonth(valid, 1)).toBe(180)   // January
    expect(amountForMonth(valid, 12)).toBe(175)  // December
  })

  it('throws for an out-of-range month', () => {
    expect(() => amountForMonth(valid, 0)).toThrow()
    expect(() => amountForMonth(valid, 13)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/seasonalProfile.test.ts`
Expected: FAIL — "Failed to resolve import './seasonalProfile'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/forecast/seasonalProfile.ts`:

```ts
/**
 * Compact per-bill seasonal profile stored in bills.seasonal_profile (jsonb).
 * 12 monthly baselines (index 0 = January) + provenance. Raw history is NOT
 * retained — this distilled shape is all that survives the one-time import.
 */

export interface SeasonalProfile {
  /** Length 12, index 0 = January. Projected baseline amount per calendar month. */
  baseline: number[]
  /** Where the profile came from. */
  source: 'import' | 'ledger'
  /** How many years of history informed it. */
  years: number
  /** ISO date the profile was computed. */
  computed_at: string
  /** Plain-English rationale (captured from the AI import in Phase 3). */
  note: string
}

/** Safely narrows untrusted jsonb (the DB column type is Json | null). */
export function parseSeasonalProfile(raw: unknown): SeasonalProfile | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const baseline = o.baseline
  if (!Array.isArray(baseline) || baseline.length !== 12) return null
  if (!baseline.every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const source = o.source === 'import' || o.source === 'ledger' ? o.source : 'ledger'
  return {
    baseline: baseline as number[],
    source,
    years: typeof o.years === 'number' ? o.years : 0,
    computed_at: typeof o.computed_at === 'string' ? o.computed_at : '',
    note: typeof o.note === 'string' ? o.note : ''
  }
}

/** Returns the profile baseline for a 1-indexed calendar month (1..12). */
export function amountForMonth(profile: SeasonalProfile, month: number): number {
  if (month < 1 || month > 12) {
    throw new Error(`amountForMonth: month out of range: ${month}`)
  }
  return profile.baseline[month - 1]!
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/seasonalProfile.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add apps/web/lib/forecast/seasonalProfile.ts apps/web/lib/forecast/seasonalProfile.test.ts
git commit -m "feat(forecast): SeasonalProfile type + safe parse + month lookup"
```

---

### Task 4: Ledger calendar-month statistics helper

**Files:**
- Create: `apps/web/lib/forecast/ledgerStats.ts`
- Test: `apps/web/lib/forecast/ledgerStats.test.ts`

This isolates the "average actual spend for category X in calendar month M across history" computation so `project.ts` stays readable.

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/forecast/ledgerStats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calendarMonthAverage, trailingMonthlyAverage, type StatTxn } from './ledgerStats'

function tx(over: Partial<StatTxn> = {}): StatTxn {
  return { date: '2025-01-15', amount: -100, type: 'Expense', category: 'Gas', ...over }
}

describe('calendarMonthAverage', () => {
  it('averages |amount| of Expense rows for the category in the given calendar month across years', () => {
    const txns = [
      tx({ date: '2024-01-10', amount: -200, category: 'Gas' }),
      tx({ date: '2025-01-12', amount: -160, category: 'Gas' }),
      tx({ date: '2025-07-12', amount: -40,  category: 'Gas' }),   // wrong month
      tx({ date: '2025-01-20', amount: -300, category: 'Other' }) // wrong category
    ]
    // Two Januaries for Gas: 200 + 160 = 360 across 2 distinct years → 180.
    expect(calendarMonthAverage(txns, 'Gas', 1)).toBe(180)
  })

  it('returns null when there is no history for that category+month', () => {
    expect(calendarMonthAverage([tx({ category: 'Gas' })], 'Water', 1)).toBeNull()
  })

  it('ignores non-Expense rows', () => {
    const txns = [
      tx({ date: '2025-01-10', amount: 500, type: 'Income', category: 'Gas' }),
      tx({ date: '2025-01-11', amount: -120, type: 'Expense', category: 'Gas' })
    ]
    expect(calendarMonthAverage(txns, 'Gas', 1)).toBe(120)
  })
})

describe('trailingMonthlyAverage', () => {
  it('averages total monthly Expense spend for the category over the trailing window', () => {
    const txns = [
      tx({ date: '2026-03-02', amount: -50, category: 'Dining' }),
      tx({ date: '2026-03-20', amount: -70, category: 'Dining' }),  // March total 120
      tx({ date: '2026-04-05', amount: -80, category: 'Dining' })   // April total 80
    ]
    // Two active months (Mar, Apr): (120 + 80) / 2 = 100.
    expect(trailingMonthlyAverage(txns, 'Dining', { year: 2026, month: 5 }, 6)).toBe(100)
  })

  it('returns 0 when there is no spend in the window', () => {
    expect(trailingMonthlyAverage([], 'Dining', { year: 2026, month: 5 }, 6)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/ledgerStats.test.ts`
Expected: FAIL — "Failed to resolve import './ledgerStats'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/forecast/ledgerStats.ts`:

```ts
/**
 * Pure statistics over the live ledger used by the projection engine.
 * All amounts are summed as |amount| on Expense rows only.
 */

export interface StatTxn {
  date: string        // ISO yyyy-mm-dd
  amount: number
  type: string
  category: string | null
}

function ym(date: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(date)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]! }
}

/**
 * Average actual spend for `category` in calendar `month` (1..12) across every
 * year present. Each distinct year contributes its summed spend; the result is
 * the mean across years. Returns null when there is no matching history.
 */
export function calendarMonthAverage(
  txns: ReadonlyArray<StatTxn>,
  category: string,
  month: number
): number | null {
  const byYear = new Map<number, number>()
  for (const t of txns) {
    if (t.type !== 'Expense') continue
    if ((t.category ?? '') !== category) continue
    const d = ym(t.date)
    if (!d || d.month !== month) continue
    byYear.set(d.year, (byYear.get(d.year) ?? 0) + Math.abs(t.amount))
  }
  if (byYear.size === 0) return null
  let sum = 0
  for (const v of byYear.values()) sum += v
  return round2(sum / byYear.size)
}

/**
 * Mean monthly spend for `category` over the `windowMonths` ending the month
 * BEFORE `asOf`. Averages over months that actually had spend; 0 if none.
 */
export function trailingMonthlyAverage(
  txns: ReadonlyArray<StatTxn>,
  category: string,
  asOf: { year: number; month: number },
  windowMonths: number
): number {
  const startIndex = asOf.year * 12 + (asOf.month - 1) - windowMonths
  const endIndex = asOf.year * 12 + (asOf.month - 1) - 1 // exclusive of asOf month
  const byMonth = new Map<number, number>()
  for (const t of txns) {
    if (t.type !== 'Expense') continue
    if ((t.category ?? '') !== category) continue
    const d = ym(t.date)
    if (!d) continue
    const idx = d.year * 12 + (d.month - 1)
    if (idx < startIndex || idx > endIndex) continue
    byMonth.set(idx, (byMonth.get(idx) ?? 0) + Math.abs(t.amount))
  }
  if (byMonth.size === 0) return 0
  let sum = 0
  for (const v of byMonth.values()) sum += v
  return round2(sum / byMonth.size)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/ledgerStats.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add apps/web/lib/forecast/ledgerStats.ts apps/web/lib/forecast/ledgerStats.test.ts
git commit -m "feat(forecast): calendar-month + trailing ledger statistics"
```

---

### Task 5: Projection engine — `project`

**Files:**
- Create: `apps/web/lib/forecast/project.ts`
- Test: `apps/web/lib/forecast/project.test.ts`

Per-bill monthly projection across a horizon, choosing a deterministic method and recording which one (for explainability).

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/forecast/project.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { project, projectDiscretionary, type ProjectBill, type StatTxn } from './project'
import type { SeasonalProfile } from './seasonalProfile'

const profile: SeasonalProfile = {
  baseline: [180, 170, 140, 90, 60, 45, 40, 40, 55, 90, 130, 175],
  source: 'import', years: 3, computed_at: '2026-06-21', note: ''
}

function bill(over: Partial<ProjectBill> = {}): ProjectBill {
  return {
    id: 'b1', name: 'Gas', tier: 'essential', category: 'Gas',
    budgetAmount: 100, isFixed: true, seasonalProfile: null, ...over
  }
}

const NO_TX: ReadonlyArray<StatTxn> = []

describe('project', () => {
  it('uses the seasonal profile when present (method seasonal-profile)', () => {
    const out = project({
      bills: [bill({ seasonalProfile: profile })],
      transactions: NO_TX, horizon: 3, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.method).toBe('seasonal-profile')
    expect(out[0]!.months.map(m => m.amount)).toEqual([180, 170, 140]) // Jan, Feb, Mar
  })

  it('wraps the calendar year across the horizon', () => {
    const out = project({
      bills: [bill({ seasonalProfile: profile })],
      transactions: NO_TX, horizon: 3, startYear: 2026, startMonth: 11
    })
    // Nov, Dec 2026 then Jan 2027
    expect(out[0]!.months.map(m => `${m.year}-${m.month}`)).toEqual(['2026-11', '2026-12', '2027-1'])
    expect(out[0]!.months.map(m => m.amount)).toEqual([130, 175, 180])
  })

  it('falls back to ledger calendar-month average for a variable bill with no profile (ledger-seasonal)', () => {
    const txns: StatTxn[] = [
      { date: '2025-01-10', amount: -200, type: 'Expense', category: 'Gas' },
      { date: '2024-01-10', amount: -160, type: 'Expense', category: 'Gas' }
    ]
    const out = project({
      bills: [bill({ isFixed: false, seasonalProfile: null })],
      transactions: txns, horizon: 1, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.method).toBe('ledger-seasonal')
    expect(out[0]!.months[0]!.amount).toBe(180) // (200+160)/2
  })

  it('projects a fixed bill flat at budgetAmount (method flat)', () => {
    const out = project({
      bills: [bill({ isFixed: true, budgetAmount: 2469.40, seasonalProfile: null })],
      transactions: NO_TX, horizon: 2, startYear: 2026, startMonth: 6
    })
    expect(out[0]!.method).toBe('flat')
    expect(out[0]!.months.map(m => m.amount)).toEqual([2469.40, 2469.40])
  })

  it('falls back to flat budgetAmount when variable bill has neither profile nor ledger history', () => {
    const out = project({
      bills: [bill({ isFixed: false, budgetAmount: 75, seasonalProfile: null })],
      transactions: NO_TX, horizon: 1, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.method).toBe('flat')
    expect(out[0]!.months[0]!.amount).toBe(75)
  })

  it('emits exactly `horizon` months per bill', () => {
    const out = project({
      bills: [bill({ seasonalProfile: profile })],
      transactions: NO_TX, horizon: 12, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.months).toHaveLength(12)
  })
})

describe('projectDiscretionary', () => {
  it('repeats the trailing monthly average across the horizon (method trend)', () => {
    const txns: StatTxn[] = [
      { date: '2026-03-02', amount: -50, type: 'Expense', category: 'Dining' },
      { date: '2026-03-20', amount: -70, type: 'Expense', category: 'Dining' }, // Mar total 120
      { date: '2026-04-05', amount: -80, type: 'Expense', category: 'Dining' }  // Apr total 80
    ]
    const out = projectDiscretionary({
      categories: [{ name: 'Dining' }],
      transactions: txns, horizon: 3, startYear: 2026, startMonth: 5
    })
    expect(out[0]!.tier).toBe('discretionary')
    expect(out[0]!.method).toBe('trend')
    expect(out[0]!.billId).toBe('cat:Dining')
    // trailing avg over Mar+Apr = (120+80)/2 = 100, repeated 3x
    expect(out[0]!.months.map(m => m.amount)).toEqual([100, 100, 100])
  })

  it('projects 0 for a category with no spend in the window', () => {
    const out = projectDiscretionary({
      categories: [{ name: 'Hobbies' }],
      transactions: [], horizon: 2, startYear: 2026, startMonth: 5
    })
    expect(out[0]!.months.map(m => m.amount)).toEqual([0, 0])
  })

  it('emits one projection line per category', () => {
    const out = projectDiscretionary({
      categories: [{ name: 'Dining' }, { name: 'Shopping' }],
      transactions: [], horizon: 1, startYear: 2026, startMonth: 5
    })
    expect(out.map(p => p.category)).toEqual(['Dining', 'Shopping'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/project.test.ts`
Expected: FAIL — "Failed to resolve import './project'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/forecast/project.ts`:

```ts
/**
 * Deterministic per-bill monthly projection across a horizon.
 *
 * Method selection per bill (recorded on the output for explainability):
 *   1. seasonal-profile  — bill has a SeasonalProfile → use its baseline.
 *   2. ledger-seasonal   — variable bill, no profile, but ledger has same-month
 *                          history → calendar-month average from the ledger.
 *   3. flat              — fixed bill (or variable with no history) → budgetAmount.
 *
 * No AI, no randomness: every number traces to a profile baseline, a ledger
 * average, or the bill's budget amount.
 */

import { amountForMonth, type SeasonalProfile } from './seasonalProfile'
import { calendarMonthAverage, trailingMonthlyAverage, type StatTxn } from './ledgerStats'
import type { SpendTier } from './tier'

export type { StatTxn } from './ledgerStats'

export type ProjectionMethod = 'seasonal-profile' | 'ledger-seasonal' | 'flat' | 'trend'

export interface ProjectBill {
  id: string
  name: string
  tier: SpendTier
  category: string | null
  /** bills.budget_amount — flat fallback + fixed-bill amount. */
  budgetAmount: number
  /** Resolved from the bill's category is_fixed. */
  isFixed: boolean
  /** Parsed bills.seasonal_profile, or null. */
  seasonalProfile: SeasonalProfile | null
}

export interface ProjectInput {
  bills: ReadonlyArray<ProjectBill>
  transactions: ReadonlyArray<StatTxn>
  horizon: number          // number of months to project
  startYear: number
  startMonth: number       // 1..12 — first projected month
}

export interface MonthlyProjection {
  year: number
  month: number            // 1..12
  amount: number           // positive projected spend
}

export interface BillProjection {
  billId: string
  billName: string
  tier: SpendTier
  category: string | null
  method: ProjectionMethod
  months: MonthlyProjection[]
}

/** Advances (year, month) by `offset` months. month is 1..12. */
function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + offset
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 }
}

export function project(input: ProjectInput): ReadonlyArray<BillProjection> {
  const { bills, transactions, horizon, startYear, startMonth } = input

  return bills.map(b => {
    // Decide the method ONCE per bill from its capabilities + available history.
    let method: ProjectionMethod
    if (b.seasonalProfile) {
      method = 'seasonal-profile'
    } else if (!b.isFixed && b.category && hasCalendarHistory(transactions, b.category)) {
      method = 'ledger-seasonal'
    } else {
      method = 'flat'
    }

    const months: MonthlyProjection[] = []
    for (let i = 0; i < horizon; i++) {
      const { year, month } = addMonths(startYear, startMonth, i)
      let amount: number
      if (method === 'seasonal-profile') {
        amount = amountForMonth(b.seasonalProfile!, month)
      } else if (method === 'ledger-seasonal') {
        amount = calendarMonthAverage(transactions, b.category!, month) ?? b.budgetAmount
      } else {
        amount = b.budgetAmount
      }
      months.push({ year, month, amount: round2(amount) })
    }

    return {
      billId: b.id,
      billName: b.name,
      tier: b.tier,
      category: b.category,
      method,
      months
    }
  })
}

/** True if the ledger has ANY same-category Expense row (so ledger-seasonal can apply). */
function hasCalendarHistory(txns: ReadonlyArray<StatTxn>, category: string): boolean {
  for (const t of txns) {
    if (t.type === 'Expense' && (t.category ?? '') === category) return true
  }
  return false
}

export interface DiscretionaryCategory {
  /** Category name (already resolved by the caller to the discretionary tier). */
  name: string
}

export interface ProjectDiscretionaryInput {
  categories: ReadonlyArray<DiscretionaryCategory>
  transactions: ReadonlyArray<StatTxn>
  horizon: number
  startYear: number
  startMonth: number
  /** Trailing window (months) for the average. Default 6. */
  windowMonths?: number
}

/**
 * Projects discretionary CATEGORIES (which have no named bill) by repeating
 * their trailing monthly average across the horizon. method = 'trend'. The
 * synthesized billId is `cat:<name>` so downstream code (rollup, proposals)
 * treats them uniformly with bill projections.
 */
export function projectDiscretionary(input: ProjectDiscretionaryInput): ReadonlyArray<BillProjection> {
  const { categories, transactions, horizon, startYear, startMonth } = input
  const windowMonths = input.windowMonths ?? 6

  return categories.map(c => {
    const avg = trailingMonthlyAverage(transactions, c.name, { year: startYear, month: startMonth }, windowMonths)
    const months: MonthlyProjection[] = []
    for (let i = 0; i < horizon; i++) {
      const { year, month } = addMonths(startYear, startMonth, i)
      months.push({ year, month, amount: round2(avg) })
    }
    return {
      billId: `cat:${c.name}`,
      billName: c.name,
      tier: 'discretionary',
      category: c.name,
      method: 'trend',
      months
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/project.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add apps/web/lib/forecast/project.ts apps/web/lib/forecast/project.test.ts
git commit -m "feat(forecast): deterministic projection engine (bills seasonal/ledger/flat + discretionary trend)"
```

---

### Task 6: Tier rollup — `rollupByTier`

**Files:**
- Create: `apps/web/lib/forecast/rollupByTier.ts`
- Test: `apps/web/lib/forecast/rollupByTier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/forecast/rollupByTier.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { rollupByTier } from './rollupByTier'
import type { BillProjection } from './project'

function proj(over: Partial<BillProjection>): BillProjection {
  return {
    billId: 'b', billName: 'B', tier: 'essential', category: 'C',
    method: 'flat',
    months: [{ year: 2026, month: 1, amount: 100 }, { year: 2026, month: 2, amount: 100 }],
    ...over
  }
}

describe('rollupByTier', () => {
  it('sums per-tier per-month totals across bills', () => {
    const out = rollupByTier([
      proj({ tier: 'essential', months: [{ year: 2026, month: 1, amount: 100 }, { year: 2026, month: 2, amount: 120 }] }),
      proj({ tier: 'essential', months: [{ year: 2026, month: 1, amount: 50 },  { year: 2026, month: 2, amount: 50 }] }),
      proj({ tier: 'services',  months: [{ year: 2026, month: 1, amount: 30 },  { year: 2026, month: 2, amount: 30 }] })
    ])
    expect(out.essential).toEqual([
      { year: 2026, month: 1, amount: 150 },
      { year: 2026, month: 2, amount: 170 }
    ])
    expect(out.services).toEqual([
      { year: 2026, month: 1, amount: 30 },
      { year: 2026, month: 2, amount: 30 }
    ])
    expect(out.discretionary).toEqual([])
  })

  it('returns empty arrays for all tiers when given no projections', () => {
    const out = rollupByTier([])
    expect(out).toEqual({ essential: [], services: [], discretionary: [] })
  })

  it('keeps months in chronological order', () => {
    const out = rollupByTier([
      proj({ tier: 'services', months: [
        { year: 2026, month: 12, amount: 10 },
        { year: 2027, month: 1, amount: 20 }
      ] })
    ])
    expect(out.services.map(m => `${m.year}-${m.month}`)).toEqual(['2026-12', '2027-1'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/rollupByTier.test.ts`
Expected: FAIL — "Failed to resolve import './rollupByTier'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/forecast/rollupByTier.ts`:

```ts
/**
 * Aggregate per-bill projections into per-tier, per-month totals — the shape
 * the Forecast chart + tier headers consume.
 */

import type { BillProjection, MonthlyProjection } from './project'
import type { SpendTier } from './tier'

export interface TierRollup {
  essential: MonthlyProjection[]
  services: MonthlyProjection[]
  discretionary: MonthlyProjection[]
}

function monthKey(p: { year: number; month: number }): number {
  return p.year * 12 + (p.month - 1)
}

function rollupOne(projections: ReadonlyArray<BillProjection>, tier: SpendTier): MonthlyProjection[] {
  const byMonth = new Map<number, MonthlyProjection>()
  for (const proj of projections) {
    if (proj.tier !== tier) continue
    for (const m of proj.months) {
      const key = monthKey(m)
      const existing = byMonth.get(key)
      if (existing) {
        existing.amount = round2(existing.amount + m.amount)
      } else {
        byMonth.set(key, { year: m.year, month: m.month, amount: round2(m.amount) })
      }
    }
  }
  return [...byMonth.values()].sort((a, b) => monthKey(a) - monthKey(b))
}

export function rollupByTier(projections: ReadonlyArray<BillProjection>): TierRollup {
  return {
    essential: rollupOne(projections, 'essential'),
    services: rollupOne(projections, 'services'),
    discretionary: rollupOne(projections, 'discretionary')
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/rollupByTier.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add apps/web/lib/forecast/rollupByTier.ts apps/web/lib/forecast/rollupByTier.test.ts
git commit -m "feat(forecast): rollupByTier aggregates projections into tier/month totals"
```

---

### Task 7: Budget proposals — `proposeBudgets`

**Files:**
- Create: `apps/web/lib/forecast/proposeBudgets.ts`
- Test: `apps/web/lib/forecast/proposeBudgets.test.ts`

Convert the next projected month into per-category proposed-vs-current budget deltas (what the propose-and-apply panel renders).

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/forecast/proposeBudgets.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { proposeBudgets, type CurrentBudget } from './proposeBudgets'
import type { BillProjection } from './project'

function proj(category: string, month: number, amount: number, over: Partial<BillProjection> = {}): BillProjection {
  return {
    billId: 'b-' + category, billName: category, tier: 'essential', category,
    method: 'flat', months: [{ year: 2026, month, amount }], ...over
  }
}

describe('proposeBudgets', () => {
  it('proposes the projected amount per category for the target month', () => {
    const out = proposeBudgets({
      projections: [proj('Gas', 7, 45), proj('Housing', 7, 2469)],
      currentBudgets: [{ category: 'Gas', amount: 120 }],
      targetYear: 2026, targetMonth: 7
    })
    const gas = out.find(r => r.category === 'Gas')!
    expect(gas.proposed).toBe(45)
    expect(gas.current).toBe(120)
    expect(gas.delta).toBe(-75)
    const housing = out.find(r => r.category === 'Housing')!
    expect(housing.current).toBe(0)    // no current budget row
    expect(housing.proposed).toBe(2469)
    expect(housing.delta).toBe(2469)
  })

  it('sums multiple bills that map to the same category', () => {
    const out = proposeBudgets({
      projections: [proj('Software & Apps', 7, 20), proj('Software & Apps', 7, 30, { billId: 'b2' })],
      currentBudgets: [],
      targetYear: 2026, targetMonth: 7
    })
    expect(out.find(r => r.category === 'Software & Apps')!.proposed).toBe(50)
  })

  it('ignores projection months that are not the target month', () => {
    const out = proposeBudgets({
      projections: [{
        billId: 'b', billName: 'Gas', tier: 'essential', category: 'Gas', method: 'flat',
        months: [{ year: 2026, month: 6, amount: 999 }, { year: 2026, month: 7, amount: 45 }]
      }],
      currentBudgets: [], targetYear: 2026, targetMonth: 7
    })
    expect(out.find(r => r.category === 'Gas')!.proposed).toBe(45)
  })

  it('skips projections with a null category', () => {
    const out = proposeBudgets({
      projections: [{ billId: 'b', billName: 'X', tier: 'essential', category: null, method: 'flat',
        months: [{ year: 2026, month: 7, amount: 10 }] }],
      currentBudgets: [], targetYear: 2026, targetMonth: 7
    })
    expect(out).toEqual([])
  })

  it('sorts results by category name', () => {
    const out = proposeBudgets({
      projections: [proj('Zeta', 7, 1), proj('Alpha', 7, 1)],
      currentBudgets: [], targetYear: 2026, targetMonth: 7
    })
    expect(out.map(r => r.category)).toEqual(['Alpha', 'Zeta'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/proposeBudgets.test.ts`
Expected: FAIL — "Failed to resolve import './proposeBudgets'".

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/forecast/proposeBudgets.ts`:

```ts
/**
 * Turn projections into per-category budget proposals for one target month.
 * The Forecast propose-and-apply panel renders these (proposed vs current);
 * applying writes proposed → budgets.amount for (category, targetYear, targetMonth).
 */

import type { BillProjection } from './project'

export interface CurrentBudget {
  category: string
  amount: number
}

export interface BudgetProposal {
  category: string
  /** Sum of projected amounts mapping to this category for the target month. */
  proposed: number
  /** Existing budgets.amount for this category, or 0 if none. */
  current: number
  /** proposed - current. Positive = budget should rise. */
  delta: number
}

export interface ProposeBudgetsInput {
  projections: ReadonlyArray<BillProjection>
  currentBudgets: ReadonlyArray<CurrentBudget>
  targetYear: number
  targetMonth: number
}

export function proposeBudgets(input: ProposeBudgetsInput): ReadonlyArray<BudgetProposal> {
  const { projections, currentBudgets, targetYear, targetMonth } = input

  // Sum projected amounts per category for the target month.
  const proposedByCategory = new Map<string, number>()
  for (const proj of projections) {
    if (!proj.category) continue
    const cell = proj.months.find(m => m.year === targetYear && m.month === targetMonth)
    if (!cell) continue
    proposedByCategory.set(proj.category, round2((proposedByCategory.get(proj.category) ?? 0) + cell.amount))
  }

  const currentByCategory = new Map<string, number>()
  for (const b of currentBudgets) {
    currentByCategory.set(b.category, (currentByCategory.get(b.category) ?? 0) + b.amount)
  }

  const rows: BudgetProposal[] = []
  for (const [category, proposed] of proposedByCategory.entries()) {
    const current = currentByCategory.get(category) ?? 0
    rows.push({ category, proposed: round2(proposed), current: round2(current), delta: round2(proposed - current) })
  }
  rows.sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }))
  return rows
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast/proposeBudgets.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/alexis.lopez/Code/financehub
git add apps/web/lib/forecast/proposeBudgets.ts apps/web/lib/forecast/proposeBudgets.test.ts
git commit -m "feat(forecast): proposeBudgets converts projections to per-category proposals"
```

---

### Task 8: Phase 1 verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full forecast test suite**

Run: `cd /Users/alexis.lopez/Code/financehub && pnpm vitest run apps/web/lib/forecast`
Expected: PASS — 6 test files, ~36 tests, 0 failures.

- [ ] **Step 2: Type-check the whole web app**

Run: `cd /Users/alexis.lopez/Code/financehub/apps/web && pnpm tsc --noEmit --pretty false`
Expected: no output (clean).

- [ ] **Step 3: Production build**

Run: `cd /Users/alexis.lopez/Code/financehub/apps/web && pnpm next build`
Expected: build completes, route table prints, no errors.

- [ ] **Step 4: Final commit (if any verification fixups were needed)**

```bash
cd /Users/alexis.lopez/Code/financehub
git add -A apps/web supabase
git commit -m "chore(forecast): Phase 1 engine verified (tests + tsc + build green)" || echo "nothing to commit"
```

---

## Phase 1 Done When

- Migration `0029` applied; `categories.tier`, `bills.tier`, `bills.seasonal_profile` exist.
- Six pure modules under `apps/web/lib/forecast/` (`tier`, `seasonalProfile`, `ledgerStats`, `project`, `rollupByTier`, `proposeBudgets`) with passing co-located tests.
- `pnpm tsc --noEmit` clean; `pnpm next build` green.

Phase 2 (Forecast surface) and Phase 3 (AI history import) are separate plans, written after Phase 1 lands.
