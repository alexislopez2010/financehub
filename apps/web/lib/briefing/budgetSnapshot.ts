import type { Tables } from '@/lib/supabase/database.types'

export type BudgetRow = Tables<'budgets'>
export type TransactionRow = Tables<'transactions'>

export interface BudgetSnapshot {
  /** Sum of all active budget amounts for the current month. */
  totalBudgeted: number
  /** Sum of |Expense| transactions for the current calendar month. */
  totalSpent: number
  /** totalSpent / totalBudgeted; null when totalBudgeted === 0. */
  utilization: number | null
  /** totalBudgeted - totalSpent (negative = over budget). */
  remaining: number
  /** 'under' | 'at' | 'over' — derived from utilization. */
  status: 'under' | 'at' | 'over'
}

export interface DeriveBudgetSnapshotInput {
  budgets: ReadonlyArray<Pick<BudgetRow, 'amount' | 'year' | 'month'>>
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date'>>
  today: { year: number; month: number }
}

const AT_LOWER = 0.9
const OVER_THRESHOLD = 1.0

/**
 * Returns the high-level budget snapshot for the current calendar month.
 *
 * Status thresholds:
 *   - 'over'  = utilization > 1.0
 *   - 'at'    = 0.9 <= utilization <= 1.0
 *   - 'under' = utilization < 0.9 (or null when no budgets exist)
 */
export function deriveBudgetSnapshot(input: DeriveBudgetSnapshotInput): BudgetSnapshot {
  const { today, budgets, transactions } = input

  let totalBudgeted = 0
  for (const b of budgets) {
    if (b.year !== today.year || b.month !== today.month) continue
    totalBudgeted += b.amount
  }

  let totalSpent = 0
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue
    const d = parseDate(tx.date)
    if (!d) continue
    if (d.year !== today.year || d.month !== today.month) continue
    totalSpent += Math.abs(tx.amount)
  }

  totalBudgeted = round2(totalBudgeted)
  totalSpent = round2(totalSpent)

  const utilization = totalBudgeted > 0 ? round4(totalSpent / totalBudgeted) : null
  const remaining = round2(totalBudgeted - totalSpent)
  const status: BudgetSnapshot['status'] =
    utilization === null
      ? 'under'
      : utilization > OVER_THRESHOLD
        ? 'over'
        : utilization >= AT_LOWER
          ? 'at'
          : 'under'

  return { totalBudgeted, totalSpent, utilization, remaining, status }
}

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]!, day: +m[3]! }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
