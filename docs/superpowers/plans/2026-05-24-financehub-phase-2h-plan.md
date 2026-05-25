# Phase 2H — Plan surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace `/plan` placeholder with the real Plan surface — month-scoped Income (planned vs actual) and Expense Budget (budgeted vs actual) sections with inline edit, add, and remove. Uses `lib/finance/incomeMatching` from 2D for income side; new pure `lib/plan/budgetVsActual` for expense side.

**Architecture:** Server-shell + Client root. URL-synced period state (`?year=2026&month=5`). Two cards, each containing a list of category/source rows with totals at top + inline-editable amount + delete + "+ Add" row. Mutations through the existing data-layer hooks (`useUpdate/Create/DeleteBudget`, `useUpdate/Create/DeleteIncomePlan`) with optimistic updates baked in.

**Tech Stack:** Existing — TanStack Query, EditableCell from 2G, Radix Dialog (none needed here; everything's inline), lucide-react.

---

## File structure

```
apps/web/
├── app/(app)/plan/
│   └── page.tsx                       Server shell mounting Plan
├── components/plan/
│   ├── Plan.tsx                       Client root: period state + data composition
│   ├── PeriodSelector.tsx             Month picker (◀ MAY 2026 ▶ + dropdown)
│   ├── PlanSummary.tsx                Two-tile KPI summary at top (Budget left vs Income received)
│   ├── BudgetSection.tsx              Expense budget card with rows + add
│   ├── BudgetRow.tsx                  One category row: name (read), budget (edit), actual (read), variance (read+tone)
│   ├── IncomeSection.tsx              Income plan card with rows + add
│   ├── IncomeRow.tsx                  One source row: name (read), planned (edit), actual (read), variance (read+tone)
│   ├── AddBudgetForm.tsx              Inline "+ Add category" form
│   ├── AddIncomeForm.tsx              Inline "+ Add source" form
│   └── *.test.tsx                     Vitest where logic is testable
└── lib/plan/
    ├── period.ts                      currentPeriod, periodLabel, parsePeriod, navigatePeriod helpers
    ├── period.test.ts
    ├── budgetVsActual.ts              Pure: budgets + transactions + period → BudgetVsActualRow[]
    └── budgetVsActual.test.ts
```

---

## Task list

| # | Task | Files |
|---|---|---|
| 1 | `lib/plan/period.ts` + `budgetVsActual.ts` (pure modules) + tests. Plan scaffold + PeriodSelector + URL-synced period state. Page placeholder swapped for the real Plan. | `lib/plan/*`, `components/plan/{Plan,PeriodSelector}.tsx`, `app/(app)/plan/page.tsx` |
| 2 | BudgetSection + BudgetRow + AddBudgetForm. Reads via `useBudgets`+`useTransactions`+`useCategories`. Inline edit on budget amount via `useUpdateBudget`. Delete row via `useDeleteBudget`. Add row via `useCreateBudget`. | `components/plan/{BudgetSection,BudgetRow,AddBudgetForm}.tsx` |
| 3 | IncomeSection + IncomeRow + AddIncomeForm. Uses `matchIncome` from 2D against `useIncomePlan`+`useTransactions`. Same edit/add/delete pattern via the corresponding hooks. | `components/plan/{IncomeSection,IncomeRow,AddIncomeForm}.tsx` |
| 4 | PlanSummary tiles + final Plan.tsx composition + verify (all tests, build, lint) + commit. | `components/plan/PlanSummary.tsx`, `components/plan/Plan.tsx` |

---

## Pure module specs

### `lib/plan/period.ts`

```ts
export interface PlanPeriod { year: number; month: number }

currentPeriod(now?: Date): PlanPeriod
periodLabel(p: PlanPeriod): string              // "May 2026"
periodLabelShort(p: PlanPeriod): string         // "MAY 2026"
parsePeriod(year: string|null, month: string|null, fallback: PlanPeriod): PlanPeriod
navigatePeriod(p: PlanPeriod, direction: -1|1): PlanPeriod   // prev/next month, year boundary safe
periodToRange(p: PlanPeriod): { startDate: string; endDate: string }  // YYYY-MM-01 → end-of-month
```

### `lib/plan/budgetVsActual.ts`

```ts
export interface BudgetVsActualRow {
  /** Budget row id (uuid). Null when there's spend in a category without a budget row. */
  budgetId: string | null
  /** Category name (matches the budget.category text field). */
  category: string
  /** category_id (FK) — present on new rows; legacy budgets may have null. */
  categoryId: string | null
  /** Budgeted amount for the period; 0 when no budget row exists. */
  budgeted: number
  /** Sum of |amount| for Expense transactions in the category for the period. */
  actual: number
  /** budgeted - actual. Positive = under budget; negative = over. */
  variance: number
}

/**
 * Pairs budget rows with transaction-derived actuals for a single period.
 * - Includes every budget row for the period, even if actual is 0.
 * - Includes any category that has Expense transactions in the period but no budget row (budgetId = null, budgeted = 0).
 * - Sorted: over-budget rows first (largest negative variance), then under-budget by largest |variance|, then alphabetical.
 */
deriveBudgetVsActual(input: {
  budgets: ReadonlyArray<BudgetRow>
  transactions: ReadonlyArray<TransactionRow>
  period: PlanPeriod
}): ReadonlyArray<BudgetVsActualRow>
```

---

## Inline edit conventions

- **Budget amount** — EditableCell (number variant), commits via `useUpdateBudget`
- **Planned income amount** — EditableCell (number variant), commits via `useUpdateIncomePlan`
- All other fields read-only for this phase (rename happens in 2L Admin / category management)

## Add / delete row conventions

- "+ Add category" inline row (similar to legacy app pattern) — picks a category from `useCategories()`, sets initial budget amount, calls `useCreateBudget`
- Per-row delete button (trash icon, lower-opacity until hover) → `useDeleteBudget(id)`
- Same shape for income (pick a source string + member optional + amount → `useCreateIncomePlan`)

## Success criteria

- `/plan` renders against live data with no console errors
- Period selector navigates prev/next month; year/month sync to URL
- Budget section shows every budget row + any unbudgeted categories with spend
- Income section shows every planned source + any unmatched income under "Uncategorized"
- Inline edit on amounts works with optimistic updates
- Add new row works for both sections
- Delete row works for both sections
- All previous tests still pass; new tests cover `period.ts` + `budgetVsActual.ts`
- Mobile (< 768px) works: cards stack, rows reflow

## Out of scope

- Editing the category name (cascades through bills, etc. — Admin handles this)
- Copying budgets from one month to another
- Multi-month bulk edit
- The legacy "Income plan: bulk-load Lopez payroll data" Excel import (one-time tool)
