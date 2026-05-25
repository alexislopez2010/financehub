import type { Tables } from '@/lib/supabase/database.types'
import { clampDay, daysUntilDue } from '@/lib/finance/dueDate'

export type BillRow = Tables<'bills'>

export type BillSortKey = 'due' | 'amount' | 'name' | 'category'

/** Strict parser: returns undefined for unknown values, so caller picks default. */
export function parseSortKey(s: string | null): BillSortKey | undefined {
  if (s === 'due' || s === 'amount' || s === 'name' || s === 'category') return s
  return undefined
}

/**
 * Comparator factory. The 'due' variant uses today + daysUntilDue
 * so we don't need to know absolute dates.
 *
 * Bills with null due_day always sort last under 'due'.
 * Stable secondary sort by name to keep test output deterministic.
 */
export function billComparator(
  key: BillSortKey,
  today: { year: number; month: number; day: number }
): (a: BillRow, b: BillRow) => number {
  return (a, b) => {
    let primary = 0
    if (key === 'due') {
      const aDays = a.due_day == null ? Number.POSITIVE_INFINITY : (daysUntilDue({ due_day: a.due_day }, today) ?? Number.POSITIVE_INFINITY)
      const bDays = b.due_day == null ? Number.POSITIVE_INFINITY : (daysUntilDue({ due_day: b.due_day }, today) ?? Number.POSITIVE_INFINITY)
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

/** Convenience: next-due ISO date for display. Null when due_day is null. */
export function nextDueDate(
  bill: BillRow,
  today: { year: number; month: number; day: number }
): string | null {
  if (bill.due_day == null) return null
  const thisMonthClamped = clampDay(bill.due_day, today.year, today.month)
  if (thisMonthClamped >= today.day) {
    return iso(today.year, today.month, thisMonthClamped)
  }
  const nextMonth = today.month === 12 ? 1 : today.month + 1
  const nextYear = today.month === 12 ? today.year + 1 : today.year
  return iso(nextYear, nextMonth, clampDay(bill.due_day, nextYear, nextMonth))
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
