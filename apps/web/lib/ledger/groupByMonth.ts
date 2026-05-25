import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>

export interface MonthGroup {
  /** "YYYY-MM" — used as a key and for sorting. */
  ym: string
  /** Display label, e.g. "May 2026". */
  label: string
  /** Transactions in this month, sorted newest first (matching server order). */
  items: ReadonlyArray<TransactionRow>
  /** Sum of all Expense amounts in this month (absolute, positive number). */
  totalExpense: number
  /** Sum of Income + Refund amounts in this month (absolute, positive number). */
  totalIncome: number
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Group an already-sorted (newest-first) transactions list into month
 * buckets. Output is newest-month first. Transactions with an invalid
 * date are silently skipped.
 */
export function groupByMonth(
  transactions: ReadonlyArray<TransactionRow>
): ReadonlyArray<MonthGroup> {
  const buckets = new Map<string, TransactionRow[]>()
  for (const tx of transactions) {
    const m = /^(\d{4})-(\d{2})-\d{2}/.exec(tx.date)
    if (!m) continue
    const ym = `${m[1]}-${m[2]}`
    let list = buckets.get(ym)
    if (!list) {
      list = []
      buckets.set(ym, list)
    }
    list.push(tx)
  }

  const result: MonthGroup[] = []
  // Sort keys descending (newest month first)
  const sortedKeys = [...buckets.keys()].sort((a, b) => b.localeCompare(a))
  for (const ym of sortedKeys) {
    const items = buckets.get(ym)!
    let totalExpense = 0
    let totalIncome = 0
    for (const tx of items) {
      const amt = Math.abs(tx.amount)
      if (tx.type === 'Expense') totalExpense += amt
      else if (tx.type === 'Income' || tx.type === 'Refund') totalIncome += amt
    }
    const [yearStr, monthStr] = ym.split('-')
    const monthIdx = parseInt(monthStr!, 10) - 1
    const label = `${MONTH_NAMES[monthIdx] ?? monthStr} ${yearStr}`
    result.push({
      ym,
      label,
      items,
      totalExpense: round2(totalExpense),
      totalIncome: round2(totalIncome)
    })
  }
  return result
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
