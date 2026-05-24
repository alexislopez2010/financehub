/**
 * Days-in-month for the calendar (1..12). Handles leap years.
 */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    throw new RangeError(`month must be in 1..12, got ${month}`)
  }
  // new Date(year, month, 0) returns the last day of month-1 (1-indexed).
  return new Date(year, month, 0).getDate()
}

/**
 * Clamp a bill's nominal due day (1..31) to the actual last day of the
 * target month. If `day` is out of range, throws.
 *
 *   clampDay(31, 2025, 2)  → 28
 *   clampDay(31, 2024, 2)  → 29  (leap year)
 *   clampDay(31, 2025, 4)  → 30
 *   clampDay(15, 2025, 7)  → 15
 *   clampDay(1,  2025, 7)  → 1
 */
export function clampDay(day: number, year: number, month: number): number {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RangeError(`day must be an integer in 1..31, got ${day}`)
  }
  return Math.min(day, daysInMonth(year, month))
}

/**
 * Whether the given bill's `due_day` falls ON the given calendar date.
 * Returns false when bill.due_day is null. The day comparison uses clampDay
 * so bills with `due_day=31` are due on Feb 28/29, Apr 30, etc.
 */
export function isDueOn(
  bill: { due_day: number | null },
  date: { year: number; month: number; day: number }
): boolean {
  if (bill.due_day == null) return false
  return clampDay(bill.due_day, date.year, date.month) === date.day
}

/**
 * Days until the next occurrence of `bill.due_day` from a given reference
 * date. Walks forward at most ~62 days (covers any monthly bill). Returns
 * null if the bill has no due_day. Returns 0 if the bill is due today.
 */
export function daysUntilDue(
  bill: { due_day: number | null },
  from: { year: number; month: number; day: number }
): number | null {
  if (bill.due_day == null) return null

  // Walk forward day by day. For a bill due on day=15 of any month, we'll find
  // the next 15th within at most 31 days. For day=31 with clamping, we'll find
  // the next clamped occurrence within at most 62 days.
  const start = new Date(Date.UTC(from.year, from.month - 1, from.day))
  for (let offset = 0; offset <= 62; offset += 1) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + offset)
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    if (clampDay(bill.due_day, year, month) === day) {
      return offset
    }
  }
  // Should be unreachable for monthly bills, but defensive:
  return null
}
