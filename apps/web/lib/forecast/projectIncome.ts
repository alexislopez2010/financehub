/**
 * Derives a flat projected monthly income for the forecast's income reference
 * line. Income is a *plan* (what the user expects), not a history projection,
 * so we take the average of the months that actually have planned income in the
 * current year — a partially-filled plan still yields a sensible monthly figure
 * instead of dragging the average toward zero.
 *
 * Pure + deterministic.
 */

import { round2 } from './utils'

export interface IncomePlanLike {
  month: number
  expected_amount: number
}

/**
 * Average planned income across the months that have any (sum > 0). Returns 0
 * when there is no planned income at all.
 */
export function monthlyPlannedIncome(plans: ReadonlyArray<IncomePlanLike>): number {
  const byMonth = new Map<number, number>()
  for (const p of plans) {
    if (!Number.isFinite(p.expected_amount)) continue
    byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.expected_amount)
  }
  const monthsWithIncome = [...byMonth.values()].filter(v => v > 0)
  if (monthsWithIncome.length === 0) return 0
  return round2(monthsWithIncome.reduce((a, b) => a + b, 0) / monthsWithIncome.length)
}
