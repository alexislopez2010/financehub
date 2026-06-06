import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>

const UNCATEGORIZED = 'Uncategorized'

export interface CfoCategoryExpenseRow {
  /** Category name; null/empty → 'Uncategorized'. */
  category: string
  /** Sum of |amount| on Expense transactions in this category, YTD. */
  totalYtd: number
  /** totalYtd / monthsElapsed. */
  avgMonthly: number
  /** Share of the YTD expense total. 0..1. Sums to 1.0 across all returned rows. */
  shareOfTotal: number
  /** Number of contributing transactions. */
  count: number
  /** IDs of the contributing transactions, in original input order. */
  transactionIds: ReadonlyArray<string>
}

export interface DeriveCfoExpenseByCategoryInput {
  transactions: ReadonlyArray<Pick<TransactionRow, 'id' | 'amount' | 'type' | 'date' | 'category'>>
  /** Calendar year for the YTD window. */
  year: number
  /** Months elapsed in `year` (1..12). Used both for the upper bound on month and as the denominator for avgMonthly. */
  monthsElapsed: number
}

/**
 * Returns every Expense category's YTD breakdown for the given calendar year,
 * sorted by total descending. Unlike spendByCategory this does NOT collapse
 * into a top-N + 'Other' — the CFO drawer needs every category visible so the
 * user can drill into any of them. Includes the contributing transaction IDs
 * so the caller can render a per-category transaction list without
 * re-filtering.
 */
export function deriveCfoExpenseByCategory(
  input: DeriveCfoExpenseByCategoryInput
): ReadonlyArray<CfoCategoryExpenseRow> {
  const { year, monthsElapsed } = input
  const yearPrefix = `${year}-`

  const totalByCat = new Map<string, number>()
  const txsByCat = new Map<string, string[]>()
  let grandTotal = 0

  for (const tx of input.transactions) {
    if (tx.type !== 'Expense') continue
    if (!tx.date.startsWith(yearPrefix)) continue
    const month = parseInt(tx.date.slice(5, 7), 10)
    if (!Number.isFinite(month) || month < 1 || month > monthsElapsed) continue

    const bucket = bucketize(tx.category)
    const value = Math.abs(tx.amount)
    totalByCat.set(bucket, (totalByCat.get(bucket) ?? 0) + value)

    let ids = txsByCat.get(bucket)
    if (!ids) {
      ids = []
      txsByCat.set(bucket, ids)
    }
    ids.push(tx.id)
    grandTotal += value
  }

  if (totalByCat.size === 0) return []

  // Guard against monthsElapsed = 0 → divide-by-zero. By construction the
  // month-bound check above rejects all rows when monthsElapsed = 0, so this
  // branch is defensive only.
  const months = monthsElapsed > 0 ? monthsElapsed : 1

  const sorted = [...totalByCat.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  return sorted.map(([category, totalYtd]) => {
    const ids = txsByCat.get(category) ?? []
    return {
      category,
      totalYtd: round2(totalYtd),
      avgMonthly: round2(totalYtd / months),
      shareOfTotal: grandTotal > 0 ? round4(totalYtd / grandTotal) : 0,
      count: ids.length,
      transactionIds: ids
    }
  })
}

function bucketize(category: string | null | undefined): string {
  const trimmed = (category ?? '').trim()
  return trimmed.length > 0 ? trimmed : UNCATEGORIZED
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000
}
