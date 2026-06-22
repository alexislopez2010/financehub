/**
 * Small shared helpers for the forecast modules. Extracted so `round2` and the
 * month-index key aren't copy-pasted across every file (DRY).
 */

/** Round to 2 decimal places (currency). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Linear month index — `year * 12 + (month - 1)`. Stable, comparable, wrap-safe. */
export function monthIndex(p: { year: number; month: number }): number {
  return p.year * 12 + (p.month - 1)
}
