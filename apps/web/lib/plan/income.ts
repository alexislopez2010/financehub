import { matchIncome } from '@/lib/finance/incomeMatching'
import type { PlanPeriod } from './period'

/**
 * Aggregated income totals for a single Plan period.
 *
 * Both `plannedIncome` and `actualIncome` are computed at the orchestrator
 * (Plan.tsx) level so child surfaces can share the numbers without each one
 * re-running `matchIncome`.
 */
export interface PlanIncomeTotals {
  readonly plannedIncome: number
  readonly actualIncome: number
}

/**
 * Pure: derives `plannedIncome` and `actualIncome` for the given period.
 *
 * - `plannedIncome` = sum of `expected_amount` across plan rows whose month
 *   matches the period's month. (Plans are year-scoped already; the month
 *   filter handles within-year selection.)
 * - `actualIncome` = sum of `matchIncome` results' `actual` field across all
 *   matched sources (including the synthetic "Uncategorized" bucket).
 *
 * Casts mirror those in `PlanSummary.tsx` / `IncomeSection.tsx`: matchIncome
 * expects `IncomePlanRow` with optional `cadence`; the generated database
 * type uses `frequency`. The matching algorithm only reads source, member,
 * year, month, is_active, and expected_amount, so the cast is safe.
 */
export function computePlanIncome(input: {
  readonly plans: ReadonlyArray<{
    readonly month: number
    readonly expected_amount: number
  }>
  readonly transactions: ReadonlyArray<unknown>
  readonly period: PlanPeriod
}): PlanIncomeTotals {
  const { plans, transactions, period } = input
  const monthPlans = plans.filter(p => p.month === period.month)
  const plannedIncome = monthPlans.reduce((s, p) => s + p.expected_amount, 0)

  const matchResults = matchIncome(
    monthPlans as unknown as Parameters<typeof matchIncome>[0],
    transactions as unknown as Parameters<typeof matchIncome>[1],
    { year: period.year, months: [period.month] }
  )

  const actualIncome = matchResults.reduce((s, r) => s + r.actual, 0)

  return { plannedIncome, actualIncome }
}
