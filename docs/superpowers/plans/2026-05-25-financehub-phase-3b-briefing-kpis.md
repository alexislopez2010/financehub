# Phase 3B — Expanded Briefing KPIs

> Subagent-driven; ~3 dispatches.

**Goal:** Bubble the most decision-relevant numbers to the top of the Briefing. Two new KPI tiles (Savings rate + Burn rate), four new cards (Spend by Category · Budget Snapshot · Income vs Expense · Top Merchants), all scoped to the **current calendar month** with month-over-month comparisons where meaningful.

**Architecture:** Pure modules in `lib/briefing/` derive the new metrics from existing TanStack-cached data (transactions, budgets, categories). No new data hooks needed. New cards are presentational only — they consume derived values and render. Layout reshuffled to group cards by intent (look-back · big-picture · look-forward).

**Current state:** Briefing has 4 KPI tiles + 3 cards (Coming Due · Forecast · Notable). After this phase: **6 KPI tiles + 7 cards.**

## Pure module additions

```
apps/web/lib/briefing/
├── kpis.ts                              EDIT — add savingsRate + burnRate30Day + monthsOfRunway
├── kpis.test.ts                         EDIT — new tests for new fields
├── spendByCategory.ts                   NEW — top N categories MTD + MoM delta
├── spendByCategory.test.ts
├── budgetSnapshot.ts                    NEW — total spent vs total budgeted MTD
├── budgetSnapshot.test.ts
├── topMerchants.ts                      NEW — top 5 merchants MTD by spend
└── topMerchants.test.ts
```

## UI additions

```
apps/web/components/briefing/
├── Briefing.tsx                         EDIT — layout reshuffle + wire new derives
├── SpendByCategoryCard.tsx              NEW
├── BudgetSnapshotCard.tsx               NEW
├── IncomeVsExpenseCard.tsx              NEW
├── TopMerchantsCard.tsx                 NEW
└── *.test.tsx                           Smoke tests
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Extend `kpis.ts` with `savingsRate` + `burnRate30Day` + `monthsOfRunway`. Add three new pure modules: `spendByCategory.ts`, `budgetSnapshot.ts`, `topMerchants.ts`. All with tests. | `lib/briefing/{kpis,spendByCategory,budgetSnapshot,topMerchants}.*` |
| 2 | Four new presentational cards: `SpendByCategoryCard`, `BudgetSnapshotCard`, `IncomeVsExpenseCard`, `TopMerchantsCard`. Light smoke tests. | `components/briefing/*Card.tsx` + `*Card.test.tsx` |
| 3 | Rewire `Briefing.tsx`: KPI row 4 → 6 tiles (Cash · Debt · This Month · Net Worth · Savings rate · Burn rate). Cards reorganized into 4 rows of 2 (Spend-by-cat \| Top-merchants · Budget \| Income-vs-Expense · Coming-due \| Forecast · Notable full-width). Final verify + commit. | `components/briefing/Briefing.tsx` |

## Pure module specs

### `kpis.ts` extensions

```ts
export interface BriefingKpis {
  cash: number
  debt: number
  thisMonthNet: number
  // NEW:
  /** (monthIncome - monthExpense) / monthIncome. 0 when monthIncome is 0. */
  savingsRate: number   // 0..1 (e.g. 0.18 = 18%)
  /** Average daily expense over the trailing 30 days. */
  burnRate30Day: number  // dollars per day
  /** cash / burnRate30Day / 30. Capped at 99 when burnRate is 0. */
  monthsOfRunway: number
}
```

`deriveKpis` extended:
- `monthIncome` already computed — keep it.
- `monthExpense` already computed — keep it.
- `savingsRate = monthIncome > 0 ? (monthIncome - monthExpense) / monthIncome : 0`. Round to 4 decimals.
- For `burnRate30Day`: iterate the same transactions array, sum `Math.abs(amount)` of `type === 'Expense'` rows where date is within the trailing 30 days from `today`. Divide by 30. Round to 2 decimals.
- `monthsOfRunway = burnRate30Day === 0 ? 99 : cash / (burnRate30Day * 30)`. Round to 1 decimal.

### `spendByCategory.ts`

```ts
export interface CategorySpendRow {
  /** Category name; null/missing → 'Uncategorized'. */
  category: string
  /** Sum of |amount| for Expense transactions this month. */
  amount: number
  /** Sum from the prior calendar month. */
  priorAmount: number
  /** (amount - priorAmount) / priorAmount; null when priorAmount === 0. */
  monthOverMonth: number | null
  /** amount / totalSpend. */
  shareOfTotal: number
}

export interface DeriveSpendByCategoryInput {
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date' | 'category'>>
  today: { year: number; month: number }
  /** Default 7. */
  top?: number
}

/**
 * Returns top-N categories by spend for the CURRENT calendar month,
 * sorted by amount descending. Rest grouped into 'Other' if total > top.
 * 'Other' includes priorAmount of all other categories combined and gets
 * its own monthOverMonth.
 */
export function deriveSpendByCategory(input: DeriveSpendByCategoryInput): ReadonlyArray<CategorySpendRow>
```

Edge cases:
- Empty transactions → returns `[]`
- Fewer than `top` distinct categories → just return them all, no 'Other' row
- A category with 0 this month but spend last month → not returned (we rank by current month)

### `budgetSnapshot.ts`

```ts
export interface BudgetSnapshot {
  /** Sum of all active budget amounts for the current month. */
  totalBudgeted: number
  /** Sum of Expense transactions for the current month, all categories. */
  totalSpent: number
  /** totalSpent / totalBudgeted; null when totalBudgeted === 0. */
  utilization: number | null
  /** totalBudgeted - totalSpent (negative = over budget). */
  remaining: number
  /** 'under' | 'at' | 'over' — derived from utilization */
  status: 'under' | 'at' | 'over'
}

export interface DeriveBudgetSnapshotInput {
  budgets: ReadonlyArray<Pick<BudgetRow, 'amount' | 'period' | 'year' | 'month'>>
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date'>>
  today: { year: number; month: number }
}

/**
 * 'over'  = utilization > 1.0
 * 'at'    = 0.9 <= utilization <= 1.0
 * 'under' = utilization < 0.9 (or null)
 */
export function deriveBudgetSnapshot(input: DeriveBudgetSnapshotInput): BudgetSnapshot
```

### `topMerchants.ts`

```ts
export interface MerchantSpendRow {
  /** Merchant = normalized description. See normalize() below. */
  merchant: string
  /** Sum of |amount| for Expense transactions matching this merchant MTD. */
  amount: number
  /** Number of transactions matching this merchant MTD. */
  count: number
}

export interface DeriveTopMerchantsInput {
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date' | 'description'>>
  today: { year: number; month: number }
  /** Default 5. */
  top?: number
}

export function deriveTopMerchants(input: DeriveTopMerchantsInput): ReadonlyArray<MerchantSpendRow>
```

Merchant normalization: collapse common variants — strip trailing digits, common suffixes like `#1234`, `*123`, `XXXX1234`; trim; uppercase first word; etc. Keep simple — overkill normalization breaks more than it helps:

```ts
function normalizeMerchant(description: string): string {
  return description
    .replace(/\s+#?\d{3,}\s*$/, '')         // trailing transaction id "#12345" or "1234567"
    .replace(/\s+x{2,}\d+\s*$/i, '')        // "XXXX1234" suffix
    .replace(/\s+\*\d+\s*$/, '')            // "*1234" suffix
    .replace(/\s+\d{2}\/\d{2}.*$/, '')      // trailing date stamp
    .trim()
    .replace(/\s{2,}/g, ' ')
    .toUpperCase()
}
```

## UI specs

### `SpendByCategoryCard.tsx`

Header: lucide `PieChart` icon (blue tone) + title "Spend by Category" + small caption "This month".
Body: list of top 7 categories.

Each row:
- Left: category name
- Center: bar (full-width container, bar width = `shareOfTotal * 100%`, bar color = brand for top 3 / muted for rest, OR all brand with varying opacity)
- Right: dollar amount + tiny MoM arrow (`▲ 12%` red / `▼ 8%` emerald / `—` muted), tabular-nums

Empty state: muted italic "No expense transactions this month yet."

### `BudgetSnapshotCard.tsx`

Header: lucide `Target` icon (purple tone) + title "Budget — This Month" + caption with `MMM YYYY`.
Body:
- Big number: `$X,XXX of $Y,YYY` (spent of budgeted)
- Below: full-width progress bar
  - Fill % = `min(utilization, 1.5) * 100 / 1.5` so over-budget still shows progress
  - Color: green (`emerald-500`) when under, amber (`amber-500`) when at, red (`red-500`) when over
  - Bar is visually capped at 100% width but the color tells the story
- Caption below the bar:
  - `under` → `$X,XXX remaining · ${utilization * 100}% used`
  - `at` → `$X,XXX remaining · close to limit`
  - `over` → `$X,XXX over budget · ${utilization * 100}% used`

Empty state (no budgets): "No budget set. [Set one in Plan]" with link.

### `IncomeVsExpenseCard.tsx`

Header: lucide `Scale` icon (purple tone) + title "This Month" + caption "Income vs Expense".
Body: two horizontal stacked bars side-by-side:
- Top bar: Income — emerald fill, width relative to `max(income, expense)`. Label: "Income · $X,XXX"
- Bottom bar: Expense — red fill, width relative to `max(income, expense)`. Label: "Expense · $X,XXX"
- Below: delta — `Net: +$X,XXX` (emerald) or `Net: −$X,XXX` (red)

Pulls from the same `monthIncome` / `monthExpense` already in `deriveKpis` — extend the export to surface them OR pass through from `Briefing.tsx`.

### `TopMerchantsCard.tsx`

Header: lucide `Store` icon (emerald tone) + title "Top Merchants" + caption "This month".
Body: list of top 5 merchants.

Each row:
- Left: merchant name (truncate at ~28 chars)
- Right: dollar amount + small `(N tx)` muted count, tabular-nums

Empty state: muted italic "No merchant spend this month yet."

### KPI row tile additions (2 new)

Add two `KpiTile` entries after the existing four:

```tsx
<KpiTile
  label="Savings Rate"
  value={`${Math.round(kpis.savingsRate * 100)}%`}
  caption={kpis.savingsRate >= 0.2 ? 'on target' : kpis.savingsRate >= 0.1 ? 'below target' : 'aggressive'}
  captionTone={kpis.savingsRate >= 0.2 ? 'positive' : kpis.savingsRate >= 0.1 ? 'neutral' : 'negative'}
  icon={PiggyBank}
  iconTone="emerald"
/>
<KpiTile
  label="Burn Rate"
  value={`$${Math.round(kpis.burnRate30Day)}/d`}
  caption={`${kpis.monthsOfRunway.toFixed(1)}mo runway`}
  captionTone={kpis.monthsOfRunway >= 6 ? 'positive' : kpis.monthsOfRunway >= 3 ? 'neutral' : 'negative'}
  icon={Flame}
  iconTone="red"
/>
```

KPI row grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` so 6 tiles flow nicely on each breakpoint (1 col mobile → 2 col tablet → 3 col mid-desktop → 6 col wide-desktop).

## Layout reshuffle (T3)

```
[ header ]

[ KPI row: 6 tiles ]

[ Spend by Category card | Top Merchants card ]

[ Budget Snapshot card   | Income vs Expense card ]

[ Coming Due card        | 30-Day Forecast card ]

[ Notable card — full width ]

[ Empty state — when applicable ]
```

Rationale: cards grouped by intent — look-back (where money went) → big-picture (this month at a glance) → look-forward (what's coming).

## Success criteria

- Briefing loads with 6 KPI tiles (was 4) and 7 cards (was 3)
- Spend-by-Category bar widths reflect actual share, MoM arrows show correct direction
- Budget snapshot color matches utilization (under/at/over)
- Income vs Expense delta matches `thisMonthNet`
- Top Merchants normalization collapses "TARGET #1234" + "TARGET #5678" into one "TARGET" row
- All KPI tiles fit nicely on mobile (single column) and desktop (3 across × 2 rows OR 6 across × 1 row depending on width)
- All existing tests still pass; new tests cover the new pure modules
- No new data hooks — pure modules consume the already-cached arrays
- Lighthouse perf unchanged (no new heavy libs)

## Out of scope

- Sparklines per category (defer; visual noise)
- Click-through from KPI tile to filtered Ledger (defer; nice-to-have but not in scope here)
- Customizable card visibility (defer; we're shipping the curated set)
- Year-to-date or rolling-30-day toggle on these cards (defer; we picked calendar month)
- Per-account filtering on the Briefing (defer; Briefing is always all-accounts)
- AI commentary / natural-language summaries (out of scope — AI is deferred)
