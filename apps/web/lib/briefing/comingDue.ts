import type { Tables } from '@/lib/supabase/database.types'
import { daysUntilDue, clampDay } from '@/lib/finance/dueDate'

export type BillRow = Tables<'bills'>

export interface BillDueItem {
  billId: string
  name: string
  amount: number
  daysUntil: number
  dueDate: string  // ISO yyyy-mm-dd
}

/**
 * Returns the next-N-days due list, sorted ascending by daysUntil.
 * Skips inactive bills + bills with null due_day.
 */
export function comingDueWithin(
  bills: ReadonlyArray<BillRow>,
  from: { year: number; month: number; day: number },
  withinDays: number
): ReadonlyArray<BillDueItem> {
  const items: BillDueItem[] = []
  for (const b of bills) {
    if (!b.is_active) continue
    if (b.due_day == null) continue
    const days = daysUntilDue({ due_day: b.due_day }, from)
    if (days == null) continue
    if (days > withinDays) continue
    items.push({
      billId: b.id,
      name: b.name,
      amount: b.budget_amount,
      daysUntil: days,
      dueDate: computeDueDate(from, b.due_day)
    })
  }
  items.sort((a, b) => a.daysUntil - b.daysUntil)
  return items
}

function computeDueDate(
  from: { year: number; month: number; day: number },
  nominalDay: number
): string {
  // The clamped day in `from`'s month — if it's already past or today and >= from.day, this month;
  // otherwise next month. Matches the daysUntilDue walk.
  const thisMonthClamped = clampDay(nominalDay, from.year, from.month)
  if (thisMonthClamped >= from.day) {
    return iso(from.year, from.month, thisMonthClamped)
  }
  // Next month
  const nextMonth = from.month === 12 ? 1 : from.month + 1
  const nextYear = from.month === 12 ? from.year + 1 : from.year
  return iso(nextYear, nextMonth, clampDay(nominalDay, nextYear, nextMonth))
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
