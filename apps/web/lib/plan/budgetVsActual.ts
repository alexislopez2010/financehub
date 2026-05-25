import type { Tables } from '@/lib/supabase/database.types'
import type { PlanPeriod } from './period'

export type BudgetRow = Tables<'budgets'>
export type TransactionRow = Tables<'transactions'>

export interface BudgetVsActualRow {
  /** Budget row id (uuid). Null when no budget row exists for this category in the period. */
  budgetId: string | null
  /** Category name (matches budget.category text). */
  category: string
  /** category_id FK if known. */
  categoryId: string | null
  /** Budgeted amount for the period; 0 when no budget row exists. */
  budgeted: number
  /** Sum of |amount| for Expense transactions in this category for the period. */
  actual: number
  /** budgeted - actual. Positive = under, negative = over. */
  variance: number
}

export interface DeriveInput {
  budgets: ReadonlyArray<BudgetRow>
  transactions: ReadonlyArray<TransactionRow>
  period: PlanPeriod
}

/**
 * Pure derivation:
 *   - For each budget row in the period, sum matching Expense transactions
 *     for that same period AND category.
 *   - Include any category that has Expense transactions in the period but
 *     no budget row (budgetId = null).
 *   - Sort: over-budget first (most negative variance first), then alphabetical.
 */
export function deriveBudgetVsActual(input: DeriveInput): ReadonlyArray<BudgetVsActualRow> {
  const { budgets, transactions, period } = input

  // Period bounds for date comparison (string-compare safe via ISO).
  const yearStr = String(period.year)
  const monthStr = String(period.month).padStart(2, '0')
  const periodPrefix = `${yearStr}-${monthStr}`

  // Filter budgets to the period.
  const periodBudgets = budgets.filter(b => b.year === period.year && b.month === period.month)

  // Sum expense actuals for the period, keyed by lowercase category name.
  // (We key by name because budgets reference category as a text column;
  // legacy + new rows both populate it.)
  const actualsByCategory = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue
    if (!tx.date.startsWith(periodPrefix)) continue
    const cat = (tx.category ?? '').trim()
    if (!cat) continue
    const key = cat.toLowerCase()
    actualsByCategory.set(key, (actualsByCategory.get(key) ?? 0) + Math.abs(tx.amount))
  }

  // Build BudgetVsActualRow for each budget, consuming the matched actual.
  const seenCategoryKeys = new Set<string>()
  const rows: BudgetVsActualRow[] = []
  for (const b of periodBudgets) {
    const cat = (b.category ?? '').trim()
    const key = cat.toLowerCase()
    seenCategoryKeys.add(key)
    const actual = round2(actualsByCategory.get(key) ?? 0)
    const budgeted = round2(b.amount)
    rows.push({
      budgetId: b.id,
      category: cat,
      categoryId: b.category_id,
      budgeted,
      actual,
      variance: round2(budgeted - actual)
    })
  }

  // Add categories that have actuals but no budget row.
  for (const [key, actualRaw] of actualsByCategory.entries()) {
    if (seenCategoryKeys.has(key)) continue
    // Find a canonical (case-preserving) name from any transaction with this category.
    const canonical = transactions.find(
      tx => (tx.category ?? '').trim().toLowerCase() === key && tx.type === 'Expense'
    )?.category ?? key
    const actual = round2(actualRaw)
    rows.push({
      budgetId: null,
      category: canonical,
      categoryId: null,
      budgeted: 0,
      actual,
      variance: round2(-actual)
    })
  }

  // Sort: most over-budget first (smallest variance), then alphabetical.
  rows.sort((a, b) => {
    if (a.variance !== b.variance) return a.variance - b.variance
    return a.category.localeCompare(b.category)
  })

  return rows
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
