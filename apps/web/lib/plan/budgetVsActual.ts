import type { Tables } from '@/lib/supabase/database.types'
import type { PlanPeriod } from './period'

export type BudgetRow = Tables<'budgets'>
export type TransactionRow = Tables<'transactions'>
export type BillRow = Tables<'bills'>

/**
 * Minimal bill shape used to compute bills committed per category.
 * Kept structural so callers can pass narrower projections.
 */
export type BillForCommitment = Pick<BillRow, 'budget_amount' | 'budget_category_id' | 'is_active'>

export interface BudgetVsActualRow {
  /**
   * Budget row id (uuid).
   *  - When exactly one budget row exists for the category, this is that row's id.
   *  - When multiple budget rows are aggregated into one display row, this is null
   *    so the UI does not offer per-row edit/delete on what looks like a sum.
   *  - When no budget row exists (actuals only), this is null.
   */
  budgetId: string | null
  /** Category display name (case preserved from a source row). */
  category: string
  /** category_id FK if all aggregated rows agree on it; null otherwise. */
  categoryId: string | null
  /** Sum of budget row amounts for this category in the period; 0 when no budget row exists. */
  budgeted: number
  /** Sum of |amount| for Expense transactions in this category for the period. */
  actual: number
  /** budgeted - actual. Positive = under, negative = over. */
  variance: number
  /** Sum of bills.budget_amount for active bills mapped to this category. */
  billsCommitted: number
  /** billsCommitted / budgeted; null when budgeted = 0. */
  billsCoverage: number | null
  /** true when billsCommitted > budgeted AND budgeted > 0. */
  billsOverCommitted: boolean
}

export interface DeriveInput {
  budgets: ReadonlyArray<BudgetRow>
  transactions: ReadonlyArray<TransactionRow>
  period: PlanPeriod
  /**
   * Active bills with budget_category_id set. Used to compute billsCommitted per row.
   * Bills with null budget_category_id are excluded (not yet mapped).
   * Bills with is_active = false are excluded.
   * Optional for callers that only render budget vs actual KPIs.
   */
  bills?: ReadonlyArray<BillForCommitment>
}

interface BudgetAggregate {
  /** Lowercased category text used as a stable grouping key. */
  key: string
  /** First budget row id, kept for the single-row case. */
  firstBudgetId: string
  /** Count of underlying budget rows grouped here. */
  count: number
  /** Display category name (case preserved from the first row). */
  displayCategory: string
  /** category_id if all aggregated rows agree; null otherwise. */
  categoryId: string | null
  /** Sum of amounts across aggregated rows. */
  amount: number
}

/**
 * Pure derivation:
 *   - Group budget rows in the period BY CATEGORY (lowercased category text as
 *     the key, since legacy imports created multiple budget rows per
 *     (category, year, month) and some rows lack category_id).
 *   - For each category, sum budgeted amounts and sum matching Expense actuals.
 *   - Include any category that has Expense transactions in the period but no
 *     budget row (budgetId = null, budgeted = 0).
 *   - When more than one budget row is aggregated, the output row's budgetId is
 *     null so the UI hides per-row edit/delete affordances.
 *   - Sort: most over-budget first (smallest variance), then alphabetical.
 */
export function deriveBudgetVsActual(input: DeriveInput): ReadonlyArray<BudgetVsActualRow> {
  const { budgets, transactions, period, bills = [] } = input

  // Period bounds for date comparison (string-compare safe via ISO).
  const yearStr = String(period.year)
  const monthStr = String(period.month).padStart(2, '0')
  const periodPrefix = `${yearStr}-${monthStr}`

  // Sum budget_amount for active bills with a mapped budget_category_id.
  // Bills with null budget_category_id are excluded (user hasn't mapped yet).
  // is_active is nullable in the schema; treat null as inactive so we only
  // count bills the user has explicitly turned on.
  const billsByCategoryId = new Map<string, number>()
  for (const b of bills) {
    if (b.is_active !== true) continue
    const cid = b.budget_category_id
    if (!cid) continue
    billsByCategoryId.set(cid, (billsByCategoryId.get(cid) ?? 0) + b.budget_amount)
  }

  // Aggregate budgets for the period by lowercase category key.
  const aggregates = new Map<string, BudgetAggregate>()
  for (const b of budgets) {
    if (b.year !== period.year || b.month !== period.month) continue
    const cat = (b.category ?? '').trim()
    if (!cat) continue
    const key = cat.toLowerCase()
    const existing = aggregates.get(key)
    if (!existing) {
      aggregates.set(key, {
        key,
        firstBudgetId: b.id,
        count: 1,
        displayCategory: cat,
        categoryId: b.category_id,
        amount: b.amount
      })
      continue
    }
    aggregates.set(key, {
      ...existing,
      count: existing.count + 1,
      // category_id only survives if every row agrees.
      categoryId: existing.categoryId === b.category_id ? existing.categoryId : null,
      amount: existing.amount + b.amount
    })
  }

  // Sum expense actuals for the period, keyed by lowercase category name.
  const actualsByCategory = new Map<string, number>()
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue
    if (!tx.date.startsWith(periodPrefix)) continue
    const cat = (tx.category ?? '').trim()
    if (!cat) continue
    const key = cat.toLowerCase()
    actualsByCategory.set(key, (actualsByCategory.get(key) ?? 0) + Math.abs(tx.amount))
  }

  // Build one output row per aggregated category.
  const rows: BudgetVsActualRow[] = []
  for (const agg of aggregates.values()) {
    const actual = round2(actualsByCategory.get(agg.key) ?? 0)
    const budgeted = round2(agg.amount)
    const billsCommitted = round2(
      agg.categoryId ? (billsByCategoryId.get(agg.categoryId) ?? 0) : 0
    )
    rows.push({
      budgetId: agg.count === 1 ? agg.firstBudgetId : null,
      category: agg.displayCategory,
      categoryId: agg.categoryId,
      budgeted,
      actual,
      variance: round2(budgeted - actual),
      billsCommitted,
      billsCoverage: budgeted > 0 ? billsCommitted / budgeted : null,
      billsOverCommitted: budgeted > 0 && billsCommitted > budgeted
    })
  }

  // Add categories that have actuals but no budget row.
  for (const [key, actualRaw] of actualsByCategory.entries()) {
    if (aggregates.has(key)) continue
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
      variance: round2(-actual),
      // Unbudgeted rows never carry a categoryId so they can't be matched to a
      // mapped bill — billsCommitted stays 0.
      billsCommitted: 0,
      billsCoverage: null,
      billsOverCommitted: false
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
