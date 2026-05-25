# Phase 2F — Briefing surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the placeholder `(app)/page.tsx` with the real Briefing surface — Masthead, lead headline + standfirst, 3 KPI stones (Cash/Debt/This month), Coming Due 14-day list, 30-day forecast sparkline, Notable rule-based callouts. First surface that consumes the data layer + finance modules together.

**Architecture:** Pure-function `lib/briefing/*` modules derive every visible value from the data-layer row arrays. The page component is a thin orchestrator: fetch via 2E hooks → derive via 2F + 2D pure functions → render via 2A editorial primitives + a hand-rolled SVG sparkline. No new runtime deps.

**Tech Stack:** Existing — TanStack Query (2E), `lib/finance/*` (2D), editorial primitives + design tokens (2A), Vitest.

---

## File structure (target end-state of 2F)

```
apps/web/
├── app/(app)/page.tsx              REBUILT — real Briefing
├── components/
│   └── charts/
│       ├── Sparkline.tsx           hand-rolled minimal SVG sparkline
│       └── Sparkline.test.tsx
└── lib/
    └── briefing/
        ├── kpis.ts                 deriveKpis(accounts, transactions, today) → {cash, debt, thisMonthNet}
        ├── kpis.test.ts
        ├── comingDue.ts            comingDueWithin(bills, from, days) → BillDueItem[]
        ├── comingDue.test.ts
        ├── notable.ts              notableCallouts(transactions, bills, today) → Callout[] (top 3 by impact)
        ├── notable.test.ts
        ├── headline.ts             buildLead(kpis, prevKpis) → { headline: string; standfirst: string }
        └── headline.test.ts
```

---

## Task list

| # | Task | Files |
|---|---|---|
| 1 | All 4 pure briefing modules + their Vitest tests (`kpis`, `comingDue`, `notable`, `headline`). Logic only — no React. | `lib/briefing/*` |
| 2 | `<Sparkline>` component — hand-rolled SVG, mobile-friendly, no axes, accepts a `points: number[]` plus optional baseline. Vitest tests for SVG path generation. | `components/charts/Sparkline*` |
| 3 | Rebuild `apps/web/app/(app)/page.tsx` to compose hooks (useAccounts, useBills, useTransactions, useIncomePlan) → run them through the pure modules → render with editorial primitives. Includes loading/empty/error states. | `app/(app)/page.tsx` |
| 4 | Final verification (typecheck, lint, build, test, playwright); commit close-out. | n/a |

---

## Module specs

### `lib/briefing/kpis.ts`

```ts
deriveKpis(input: {
  accounts: ReadonlyArray<Pick<AccountRow, 'id'|'type'|'is_active'|'starting_balance'>>
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount'|'type'|'date'|'account_id'>>
  today: { year: number; month: number }
}): {
  cash: number       // sum of (starting_balance + signed activity since account opening) for checking/savings
  debt: number       // abs sum of credit/loan account balances (positive number representing what's owed)
  thisMonthNet: number  // (Income + Refund) - Expense for transactions where date.year/month === today
}
```

Activity calculation: for each cash account, `currentBalance = startingBalance + sumOfSignedActivity` where activity = `+amount for Income/Refund`, `-amount for Expense`, `+amount for Transfer` (the sign is already stored correctly in the new schema).

### `lib/briefing/comingDue.ts`

```ts
export interface BillDueItem {
  billId: string
  name: string
  amount: number
  /** Days from `from` to the next due occurrence. */
  daysUntil: number
  /** ISO yyyy-mm-dd of the next occurrence. */
  dueDate: string
}

comingDueWithin(
  bills: ReadonlyArray<BillRow>,
  from: { year: number; month: number; day: number },
  withinDays: number  // typically 14
): ReadonlyArray<BillDueItem>
```

Uses `dueDate.daysUntilDue` (from 2D). Skips inactive bills + bills with null `due_day`. Sorted ascending by `daysUntil`.

### `lib/briefing/notable.ts`

```ts
export type CalloutKind = 'duplicate_charge' | 'category_swing' | 'slipped_bill' | 'new_merchant' | 'income_variance'

export interface Callout {
  kind: CalloutKind
  /** Bold lead, e.g., "Duplicate charge." */
  lead: string
  /** Sentence body, e.g., "Anthropic billed twice on May 18 — $200 each." */
  body: string
  /** Absolute-dollar impact used to rank callouts. Top 3 win. */
  impact: number
}

notableCallouts(input: {
  transactions: ReadonlyArray<TransactionRow>
  bills: ReadonlyArray<BillRow>
  today: { year: number; month: number; day: number }
  /** Trailing months to compare category spending against (default 3). */
  trailingMonths?: number
}): ReadonlyArray<Callout>  // top 3 by impact
```

Phase 2 rules per spec Section 3:
- **duplicate_charge** — same description + same amount within 7 days (same household)
- **category_swing** — current-month spend in a category deviates >15% from trailing 3-month average
- **slipped_bill** — bill due date has passed (within last 7 days) AND no matching transaction within ±3 days
- **new_merchant** — first appearance of a merchant in transaction history (defer to Phase 2J's better impl; for 2F, scan only the last 30 days vs all-time history available)
- **income_variance** — actual income deviates >10% from planned (uses incomePlan; defer if no plan present)

Pick the highest-impact 3.

### `lib/briefing/headline.ts`

```ts
buildLead(input: {
  kpis: { cash: number; debt: number; thisMonthNet: number }
  prevMonthNet?: number  // optional comparison
  thisMonthLabel: string  // e.g. "this month"
}): { headline: string; standfirst: string }
```

Rules:
- If `thisMonthNet > 0`: "Net worth, up <pct>% this month." (where pct = thisMonthNet / (cash + debt) × 100, rounded to 1dp)
- If `thisMonthNet < 0`: "Net cash flow down <abs>$ this month."
- If `thisMonthNet === 0`: "Held steady this month."
- Standfirst: 1-2 sentences summarising the move (use prev month if available for comparison).

---

## Sparkline component

Plain SVG, no library. Accepts `points: number[]`, computes the path, scales to viewBox. Optional baseline (dashed horizontal line at a given value). Tests check the generated `d` attribute on the path for known inputs (small fixtures, exact match).

---

## Success criteria

- `/` (the Briefing) renders against live data with no console errors
- All 5 sections present: Masthead (existing), Headline+Standfirst, 3 KPI stones, Coming Due, Sparkline forecast, Notable callouts
- Loading states use the skeleton convention; empty states explain what's missing
- All previous tests still pass; new tests cover pure briefing modules + sparkline
- Coverage on `lib/briefing/*` ≥ 90% lines

---

## Out of scope

- Editing transactions / bills / etc. directly from the briefing
- Net worth chart (Phase 3)
- Claude-generated lead/notable copy (Phase 4)
