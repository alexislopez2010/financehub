import type { Tables } from '@/lib/supabase/database.types'
import { billOccurrencesIn } from '@/lib/finance/billCadence'

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
 *
 * Cadence-aware: a biweekly bill with due_day=1 emits TWO items in a 14-day
 * window (day 1 and day 15). Monthly bills behave identically to before.
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
    const occurrences = billOccurrencesIn(
      { due_day: b.due_day, frequency: b.frequency },
      from,
      withinDays
    )
    for (const occ of occurrences) {
      items.push({
        billId: b.id,
        name: b.name,
        amount: b.budget_amount,
        daysUntil: occ.daysUntil,
        dueDate: iso(occ.date.year, occ.date.month, occ.date.day)
      })
    }
  }
  // Sort ascending by daysUntil, then by amount desc within the same day so
  // bigger bills surface first on tie days.
  items.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
    return b.amount - a.amount
  })
  return items
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
