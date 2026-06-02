import { clampDay, daysInMonth } from './dueDate'

/**
 * Normalize a free-text bill frequency into a small enum the cadence logic
 * understands. Self-contained — we don't import `normalizeCadence` from
 * forecast.ts because forecast.ts re-uses this module, and a cycle would
 * cause bundler issues. The mapping is intentionally narrow: anything we
 * can't confidently identify as "every two weeks" / "twice a month" falls
 * back to monthly so the user sees the old behavior for unfamiliar values.
 */
function normalizeBillCadence(freq: string | null | undefined): 'monthly' | 'biweekly' {
  if (!freq) return 'monthly'
  const n = freq.toLowerCase().replace(/[-_\s]/g, '')
  if (n === 'biweekly' || n === 'semimonthly') return 'biweekly'
  return 'monthly'
}

/**
 * Bill input shape for cadence-aware due-date checks. Only the fields we
 * actually read — keeps callers from having to construct a full BillRow.
 */
export interface BillCadenceInput {
  readonly due_day: number | null
  readonly frequency: string | null
}

/**
 * Returns true when the supplied bill is due on the given calendar date,
 * respecting `frequency`. Falls back to monthly semantics when frequency is
 * null or unrecognized so behavior is identical to the legacy `isDueOn`
 * helper for the (overwhelmingly common) monthly case.
 *
 * Cadence rules:
 *   - 'monthly'    → one occurrence per calendar month, at `clampDay(due_day)`
 *   - 'biweekly'   → two occurrences per calendar month: at `clampDay(due_day)`
 *                    and at `due_day + 14` (clamped). If `due_day + 14` exceeds
 *                    the month's length, the second occurrence rolls into the
 *                    following month — which we detect by checking whether
 *                    the PREVIOUS month's first occurrence + 14 lands on `date`.
 *   - 'semimonthly'→ alias for biweekly here (semantically "twice a month").
 *                    For income this means 15th + last day; for bills the only
 *                    sensible anchor we have is `due_day`, so we use the same
 *                    "due_day and due_day + 14" rule.
 *
 * Weekly / quarterly / annual are not represented in the user's data and the
 * schema has no field to anchor them, so they fall back to monthly. Caller
 * code that needs richer cadences will need a schema change first.
 */
export function isBillDueOn(
  bill: BillCadenceInput,
  date: { year: number; month: number; day: number }
): boolean {
  if (bill.due_day == null) return false

  const cadence = normalizeBillCadence(bill.frequency)
  const firstThisMonth = clampDay(bill.due_day, date.year, date.month)

  // First occurrence: identical across all cadences.
  if (firstThisMonth === date.day) return true

  if (cadence === 'biweekly') {
    // Second occurrence within this month, if due_day + 14 still fits.
    const lastDay = daysInMonth(date.year, date.month)
    if (bill.due_day + 14 <= lastDay && bill.due_day + 14 === date.day) {
      return true
    }

    // Overflow into next month: if the PREVIOUS month's first occurrence
    // (due_day clamped) + 14 lands on `date`, this is the second occurrence
    // of the previous month's biweekly pair. Example: due_day=25 in a
    // 30-day month → 25 + 14 = 39 → rolls to day 9 of next month.
    const prevMonth = date.month === 1 ? 12 : date.month - 1
    const prevYear = date.month === 1 ? date.year - 1 : date.year
    const prevLastDay = daysInMonth(prevYear, prevMonth)
    const prevFirst = clampDay(bill.due_day, prevYear, prevMonth)
    if (prevFirst + 14 > prevLastDay) {
      const rolled = prevFirst + 14 - prevLastDay
      if (rolled === date.day) return true
    }
  }

  return false
}

/**
 * All calendar dates inside [start, start + windowDays] (inclusive) on which
 * the bill is due. Returned in ascending chronological order. Same cadence
 * rules as {@link isBillDueOn}.
 *
 * Walks day-by-day rather than computing occurrences arithmetically — keeps
 * the implementation tiny and lets it reuse {@link isBillDueOn}'s edge cases
 * (overflow, leap year, clamping) for free.
 */
export function billOccurrencesIn(
  bill: BillCadenceInput,
  start: { year: number; month: number; day: number },
  windowDays: number
): ReadonlyArray<{ daysUntil: number; date: { year: number; month: number; day: number } }> {
  if (bill.due_day == null) return []
  if (windowDays < 0) return []

  const out: Array<{ daysUntil: number; date: { year: number; month: number; day: number } }> = []
  let cursor = new Date(Date.UTC(start.year, start.month - 1, start.day))

  for (let offset = 0; offset <= windowDays; offset += 1) {
    const date = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate()
    }
    if (isBillDueOn(bill, date)) {
      out.push({ daysUntil: offset, date })
    }
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return out
}
