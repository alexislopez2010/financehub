/**
 * 50 / 30 / 20 budgeting framework derivation.
 *
 * Target allocation of monthly take-home income:
 *   - 50%  Needs    (housing, utilities, groceries, transportation, insurance,
 *                    minimum debt payments — anything you HAVE to pay)
 *   - 30%  Wants    (dining, entertainment, shopping, hobbies)
 *   - 20%  Savings  (savings, investments, debt principal beyond minimums)
 *
 * Inputs:
 *   - Planned monthly income: sum of income_plan.expected_amount for the
 *     current month (treated as the household's recurring monthly take-home).
 *   - Actual spend: YTD expense (incl. one-offs) ÷ months elapsed, split by
 *     categories.is_fixed (true → Needs, false → Wants).
 *   - Savings is derived as plannedIncome − needsActual − wantsActual; this
 *     captures "money left over" regardless of where it ended up sitting.
 *
 * All numbers are MONTHLY averages so the comparison to 50/30/20 targets is
 * apples-to-apples.
 */

import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>
export type CategoryRow = Tables<'categories'>

export interface FiftyThirtyTwentyInput {
  /** Monthly planned/budgeted income (sum of active income_plan for the month). */
  monthlyIncome: number
  transactions: ReadonlyArray<TransactionRow>
  categories: ReadonlyArray<CategoryRow>
  /** YTD window. */
  year: number
  /** 1..12. Used to convert YTD spend → monthly average. */
  monthsElapsed: number
}

export interface BucketRow {
  /** Allocation target in dollars (monthlyIncome × targetPct). */
  target: number
  /** Average monthly spend in this bucket from actual transactions YTD. */
  actual: number
  /** target − actual. Positive = under budget; negative = over. */
  variance: number
  /** target / monthlyIncome (always 0.5/0.3/0.2 for needs/wants/savings). */
  targetPct: number
  /** actual / monthlyIncome. 0 if income is 0. */
  actualPct: number
}

export interface FiftyThirtyTwentyResult {
  monthlyIncome: number
  monthsElapsed: number
  needs: BucketRow
  wants: BucketRow
  savings: BucketRow
  /** Sum of |amount| spent YTD on Expense rows whose category is unclassified. */
  unclassifiedYtdExpense: number
}

const NEEDS_TARGET_PCT   = 0.50
const WANTS_TARGET_PCT   = 0.30
const SAVINGS_TARGET_PCT = 0.20

/**
 * Returns 50/30/20 target vs actual + variance for the current YTD window.
 * Pure — caller fetches transactions + categories + planned income separately.
 */
export function deriveFiftyThirtyTwenty(
  input: FiftyThirtyTwentyInput
): FiftyThirtyTwentyResult {
  const { monthlyIncome, transactions, categories, year, monthsElapsed } = input
  const yearPrefix = `${year}-`

  // Index categories by id so we can resolve transaction.category_id → is_fixed
  // in one pass. The text-only `transaction.category` field is the fallback for
  // rows where category_id wasn't set (older imports).
  const isFixedById   = new Map<string, boolean | null>()
  const isFixedByName = new Map<string, boolean | null>()
  for (const c of categories) {
    if (c.type !== 'expense') continue
    isFixedById.set(c.id, c.is_fixed)
    isFixedByName.set(c.name.trim().toLowerCase(), c.is_fixed)
  }

  let needsYtd = 0
  let wantsYtd = 0
  let unclassifiedYtd = 0

  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue
    if (!tx.date.startsWith(yearPrefix)) continue
    const v = Math.abs(tx.amount)

    // Resolve is_fixed via FK first, then text fallback.
    let isFixed: boolean | null | undefined
    if (tx.category_id) isFixed = isFixedById.get(tx.category_id)
    if (isFixed == null && tx.category) {
      isFixed = isFixedByName.get(tx.category.trim().toLowerCase())
    }

    if (isFixed === true) needsYtd += v
    else if (isFixed === false) wantsYtd += v
    else unclassifiedYtd += v
  }

  const months = monthsElapsed > 0 ? monthsElapsed : 1
  const needsActual = needsYtd / months
  const wantsActual = wantsYtd / months
  // Savings is the residual — whatever's left over per month after the two
  // expense buckets. Can be negative if you're spending more than you earn.
  const savingsActual = monthlyIncome - needsActual - wantsActual

  const needsTarget   = monthlyIncome * NEEDS_TARGET_PCT
  const wantsTarget   = monthlyIncome * WANTS_TARGET_PCT
  const savingsTarget = monthlyIncome * SAVINGS_TARGET_PCT

  return {
    monthlyIncome: round2(monthlyIncome),
    monthsElapsed,
    needs: makeRow(needsTarget, needsActual, NEEDS_TARGET_PCT, monthlyIncome),
    wants: makeRow(wantsTarget, wantsActual, WANTS_TARGET_PCT, monthlyIncome),
    savings: makeRow(savingsTarget, savingsActual, SAVINGS_TARGET_PCT, monthlyIncome),
    unclassifiedYtdExpense: round2(unclassifiedYtd)
  }
}

function makeRow(target: number, actual: number, targetPct: number, income: number): BucketRow {
  return {
    target: round2(target),
    actual: round2(actual),
    variance: round2(target - actual),
    targetPct,
    actualPct: income > 0 ? round4(actual / income) : 0
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
