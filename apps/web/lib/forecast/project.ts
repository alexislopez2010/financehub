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
