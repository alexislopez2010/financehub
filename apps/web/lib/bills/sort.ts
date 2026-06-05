import type { Tables } from '@/lib/supabase/database.types'
import { nextBillOccurrence } from '@/lib/finance/billCadence'

export type BillRow = Tables<'bills'>

export type BillSortKey = 'due' | 'amount' | 'name' | 'category'

/** Strict parser: returns undefined for unknown values, so caller picks default. */
export function parseSortKey(s: string | null): BillSortKey | undefined {
  if (s === 'due' || s === 'amount' || s === 'name' || s === 'category') return s
  return undefined
}

/**
 * Comparator factory. The 'due' variant routes through nextBillOccurrence
 * so quarterly + annual cadences sort correctly — a Quarterly bill anchored
 * to September is "due in N days from now" where N counts to Sep 1, not to
 * the next nominal day-of-month (which would put it weeks ahead of its
 * actual cadence).
 *
 * Bills with no scheduled next occurrence (null due_day, or Quarterly/Annual
 * without an anchor month) sort last under 'due'.
 * Stable secondary sort by name to keep test output deterministic.
 */
export function billComparator(
  key: BillSortKey,
  today: { year: number; month: number; day: number }
): (a: BillRow, b: BillRow) => number {
  return (a, b) => {
    let primary = 0
    if (key === 'due') {
      const aDays = nextBillOccurrence(a, today)?.daysUntil ?? Number.POSITIVE_INFINITY
      const bDays = nextBillOccurrence(b, today)?.daysUntil ?? Number.POSITIVE_INFINITY
      primary = aDays - bDays
    } else if (key === 'amount') {
      // Descending amount (biggest bills first)
      primary = b.budget_amount - a.budget_amount
    } else if (key === 'name') {
      primary = a.name.localeCompare(b.name)
    } else if (key === 'category') {
      primary = (a.category ?? '').localeCompare(b.category ?? '')
    }
    if (primary !== 0) return primary
    return a.name.localeCompare(b.name)
  }
}

/**
 * Convenience: next-due ISO date for display, respecting cadence.
 * Null when the bill has no scheduled next occurrence (no due_day, or
 * Quarterly/Annual without due_month_anchor).
 */
export function nextDueDate(
  bill: BillRow,
  today: { year: number; month: number; day: number }
): string | null {
  const occ = nextBillOccurrence(bill, today)
  if (!occ) return null
  return iso(occ.date.year, occ.date.month, occ.date.day)
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
