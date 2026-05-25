import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>

export interface CategorySpendRow {
  /** Category name; null/missing → 'Uncategorized'. */
  category: string
  /** Sum of |amount| for Expense transactions this month. */
  amount: number
  /** Sum from the prior calendar month for the same category bucket. */
  priorAmount: number
  /** (amount - priorAmount) / priorAmount; null when priorAmount === 0. */
  monthOverMonth: number | null
  /** amount / sum-of-returned-row-amounts. */
  shareOfTotal: number
}

export interface DeriveSpendByCategoryInput {
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date' | 'category'>>
  today: { year: number; month: number }
  /** Default 7. */
  top?: number
}

const UNCATEGORIZED = 'Uncategorized'
const OTHER = 'Other'
const DEFAULT_TOP = 7

/**
 * Returns top-N categories by Expense spend for the CURRENT calendar month,
 * sorted by amount descending. Categories beyond the top N collapse into a
 * single 'Other' row with its own priorAmount + MoM. Returned shares
 * (shareOfTotal) sum to 1.0 across all returned rows. 'Other' is always last
 * regardless of its amount.
 */
export function deriveSpendByCategory(
  input: DeriveSpendByCategoryInput
): ReadonlyArray<CategorySpendRow> {
  const top = input.top ?? DEFAULT_TOP
  const { year: curYear, month: curMonth } = input.today
  const prior = priorMonth(curYear, curMonth)

  // Aggregate current + prior month sums per category bucket.
  const currentByCat = new Map<string, number>()
  const priorByCat = new Map<string, number>()

  for (const tx of input.transactions) {
    if (tx.type !== 'Expense') continue
    const d = parseDate(tx.date)
    if (!d) continue
    const bucket = bucketize(tx.category)
    const value = Math.abs(tx.amount)
    if (d.year === curYear && d.month === curMonth) {
      currentByCat.set(bucket, (currentByCat.get(bucket) ?? 0) + value)
    } else if (d.year === prior.year && d.month === prior.month) {
      priorByCat.set(bucket, (priorByCat.get(bucket) ?? 0) + value)
    }
  }

  if (currentByCat.size === 0) return []

  // Sort categories by current spend desc; tiebreak alphabetically for stable output.
  const sorted = [...currentByCat.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0])
  })

  const topEntries = sorted.slice(0, top)
  const restEntries = sorted.slice(top)

  // Compute returned row amounts to derive shareOfTotal (sums to 1.0 across returned rows).
  let totalReturnedAmount = topEntries.reduce((acc, [, amt]) => acc + amt, 0)
  if (restEntries.length > 0) {
    totalReturnedAmount += restEntries.reduce((acc, [, amt]) => acc + amt, 0)
  }

  const rows: CategorySpendRow[] = topEntries.map(([category, amount]) => {
    const priorAmount = priorByCat.get(category) ?? 0
    return {
      category,
      amount: round2(amount),
      priorAmount: round2(priorAmount),
      monthOverMonth: priorAmount > 0 ? round4((amount - priorAmount) / priorAmount) : null,
      shareOfTotal: totalReturnedAmount > 0 ? round4(amount / totalReturnedAmount) : 0
    }
  })

  if (restEntries.length > 0) {
    const otherAmount = restEntries.reduce((acc, [, amt]) => acc + amt, 0)
    // 'Other' priorAmount = sum of prior month for the SAME categories that fell into 'Other'.
    const otherCats = new Set(restEntries.map(([cat]) => cat))
    let otherPrior = 0
    for (const [cat, val] of priorByCat.entries()) {
      if (otherCats.has(cat)) otherPrior += val
    }
    rows.push({
      category: OTHER,
      amount: round2(otherAmount),
      priorAmount: round2(otherPrior),
      monthOverMonth: otherPrior > 0 ? round4((otherAmount - otherPrior) / otherPrior) : null,
      shareOfTotal: totalReturnedAmount > 0 ? round4(otherAmount / totalReturnedAmount) : 0
    })
  }

  return rows
}

function bucketize(category: string | null | undefined): string {
  const trimmed = (category ?? '').trim()
  return trimmed.length > 0 ? trimmed : UNCATEGORIZED
}

function priorMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
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
