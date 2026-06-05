import type { Tables } from '@/lib/supabase/database.types'
import type { PlanPeriod } from './period'
import { occurrencesInMonth } from '@/lib/finance/billCadence'

export type BillRow = Tables<'bills'>

/**
 * Minimal bill projection used to itemize the bills column on the Plan
 * surface. The drawer only needs identity, cadence, amount, and the FK that
 * maps the bill to a budget category — everything else (notes, account,
 * created_at, etc.) is irrelevant here and we don't want to widen the type
 * surface.
 */
export type BillForCategory = Pick<
  BillRow,
  | 'id'
  | 'name'
  | 'budget_amount'
  | 'budget_category_id'
  | 'is_active'
  | 'frequency'
  | 'due_day'
  | 'due_month_anchor'
  | 'account'
>

/**
 * One row in the BillsCommitted drawer for a Plan period: the originating
 * bill, how many times it lands in that period, and the dollar contribution
 * to the category's bills-committed total.
 */
export interface BillContribution {
  /** Bill id — used as React key and for downstream link-outs. */
  id: string
  /** Display name from bills.name. */
  name: string
  /** Per-occurrence amount (bills.budget_amount). */
  perOccurrenceAmount: number
  /** Times the bill recurs in this specific calendar month. */
  occurrenceCount: number
  /** perOccurrenceAmount * occurrenceCount. Already rounded to 2 decimals. */
  contribution: number
  /**
   * Raw frequency string from bills.frequency. Left as-is so the UI can
   * render the user's original label (e.g., "Quarterly", "biweekly") rather
   * than guessing at normalization.
   */
  frequency: string | null
  /** Anchor month (1..12) for Quarterly/Annual; null otherwise. */
  dueMonthAnchor: number | null
  /** Day of month the bill lands on (1..31, or null if unscheduled). */
  dueDay: number | null
  /** Free-text account label, surfaced for tooltips / drawer context. */
  account: string | null
}

export interface BillsForCategoryInput {
  bills: ReadonlyArray<BillForCategory>
  /** category_id of the row being drilled into. Null categoryId returns []. */
  categoryId: string | null
  period: PlanPeriod
}

/**
 * Pure derivation: which active bills contribute to a given budget category
 * row in the supplied Plan period, and by how much.
 *
 * Mirrors the math in deriveBudgetVsActual's bills aggregation — anything
 * that adds to `billsCommitted` on the row also appears here, so the drawer
 * and the column header can never disagree.
 *
 * Filtering:
 *   - Inactive bills (is_active != true) are excluded.
 *   - Bills with budget_category_id != categoryId are excluded.
 *   - Bills whose occurrencesInMonth returns 0 for the period are excluded
 *     (e.g., a Quarterly bill in an off-quarter month).
 *
 * Sort: contribution descending (biggest line items first), then name
 * ascending for a stable secondary order.
 */
export function billsForCategory(input: BillsForCategoryInput): ReadonlyArray<BillContribution> {
  const { bills, categoryId, period } = input
  if (!categoryId) return []

  const rows: BillContribution[] = []
  for (const b of bills) {
    if (b.is_active !== true) continue
    if (b.budget_category_id !== categoryId) continue
    const count = occurrencesInMonth(
      { due_day: b.due_day, frequency: b.frequency, due_month_anchor: b.due_month_anchor },
      period.year,
      period.month
    )
    if (count === 0) continue
    rows.push({
      id: b.id,
      name: b.name,
      perOccurrenceAmount: round2(b.budget_amount),
      occurrenceCount: count,
      contribution: round2(b.budget_amount * count),
      frequency: b.frequency,
      dueMonthAnchor: b.due_month_anchor,
      dueDay: b.due_day,
      account: b.account
    })
  }

  rows.sort((a, b) => {
    if (b.contribution !== a.contribution) return b.contribution - a.contribution
    return a.name.localeCompare(b.name)
  })

  return rows
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
