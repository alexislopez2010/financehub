import type { TransactionRow } from '@/lib/finance/types'
import type { PlanPeriod } from './period'

export interface BudgetRowTransactionInput {
  readonly transactions: ReadonlyArray<TransactionRow>
  readonly period: PlanPeriod
  /** Category name as displayed on the row (case-insensitive match). */
  readonly category: string
}

/**
 * Pure helper: returns the Expense transactions inside `period` whose category
 * matches `category` (case-insensitive). This is the same match used by
 * {@link deriveBudgetVsActual} when summing actuals, so the sum of these
 * transactions is guaranteed to equal the row's `actual` value.
 *
 * Returned in descending order by absolute amount, ties broken by date desc,
 * so the largest contributors surface first.
 */
export function transactionsForBudgetRow(
  input: BudgetRowTransactionInput
): ReadonlyArray<TransactionRow> {
  const target = input.category.trim().toLowerCase()
  if (!target) return []
  const periodPrefix = `${input.period.year}-${String(input.period.month).padStart(2, '0')}`

  const matches: TransactionRow[] = []
  for (const tx of input.transactions) {
    if (tx.type !== 'Expense') continue
    if (!tx.date.startsWith(periodPrefix)) continue
    const cat = (tx.category ?? '').trim().toLowerCase()
    if (cat !== target) continue
    matches.push(tx)
  }

  matches.sort((a, b) => {
    const diff = Math.abs(b.amount) - Math.abs(a.amount)
    if (diff !== 0) return diff
    // Ties: most recent first.
    return b.date.localeCompare(a.date)
  })

  return matches
}
