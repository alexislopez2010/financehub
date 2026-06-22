/**
 * Pure statistics over the live ledger used by the projection engine.
 * All amounts are summed as |amount| on Expense rows only.
 */

export interface StatTxn {
  date: string        // ISO yyyy-mm-dd
  amount: number
  type: string
  category: string | null
}

function ym(date: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(date)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]! }
}

/**
 * Average actual spend for `category` in calendar `month` (1..12) across every
 * year present. Each distinct year contributes its summed spend; the result is
 * the mean across years. Returns null when there is no matching history.
 */
export function calendarMonthAverage(
  txns: ReadonlyArray<StatTxn>,
  category: string,
  month: number
): number | null {
  const byYear = new Map<number, number>()
  for (const t of txns) {
    if (t.type !== 'Expense') continue
    if ((t.category ?? '') !== category) continue
    const d = ym(t.date)
    if (!d || d.month !== month) continue
    byYear.set(d.year, (byYear.get(d.year) ?? 0) + Math.abs(t.amount))
  }
  if (byYear.size === 0) return null
  let sum = 0
  for (const v of byYear.values()) sum += v
  return round2(sum / byYear.size)
}

/**
 * Mean monthly spend for `category` over the `windowMonths` ending the month
 * BEFORE `asOf`. Averages over months that actually had spend; 0 if none.
 */
export function trailingMonthlyAverage(
  txns: ReadonlyArray<StatTxn>,
  category: string,
  asOf: { year: number; month: number },
  windowMonths: number
): number {
  const startIndex = asOf.year * 12 + (asOf.month - 1) - windowMonths
  const endIndex = asOf.year * 12 + (asOf.month - 1) - 1 // exclusive of asOf month
  const byMonth = new Map<number, number>()
  for (const t of txns) {
    if (t.type !== 'Expense') continue
    if ((t.category ?? '') !== category) continue
    const d = ym(t.date)
    if (!d) continue
    const idx = d.year * 12 + (d.month - 1)
    if (idx < startIndex || idx > endIndex) continue
    byMonth.set(idx, (byMonth.get(idx) ?? 0) + Math.abs(t.amount))
  }
  if (byMonth.size === 0) return 0
  let sum = 0
  for (const v of byMonth.values()) sum += v
  return round2(sum / byMonth.size)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
