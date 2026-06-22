/**
 * Aggregate per-bill projections into per-tier, per-month totals — the shape
 * the Forecast chart + tier headers consume.
 */

import type { BillProjection, MonthlyProjection } from './project'
import type { SpendTier } from './tier'

export interface TierRollup {
  essential: MonthlyProjection[]
  services: MonthlyProjection[]
  discretionary: MonthlyProjection[]
}

function monthKey(p: { year: number; month: number }): number {
  return p.year * 12 + (p.month - 1)
}

function rollupOne(projections: ReadonlyArray<BillProjection>, tier: SpendTier): MonthlyProjection[] {
  const byMonth = new Map<number, MonthlyProjection>()
  for (const proj of projections) {
    if (proj.tier !== tier) continue
    for (const m of proj.months) {
      const key = monthKey(m)
      const existing = byMonth.get(key)
      if (existing) {
        existing.amount = round2(existing.amount + m.amount)
      } else {
        byMonth.set(key, { year: m.year, month: m.month, amount: round2(m.amount) })
      }
    }
  }
  return [...byMonth.values()].sort((a, b) => monthKey(a) - monthKey(b))
}

export function rollupByTier(projections: ReadonlyArray<BillProjection>): TierRollup {
  return {
    essential: rollupOne(projections, 'essential'),
    services: rollupOne(projections, 'services'),
    discretionary: rollupOne(projections, 'discretionary')
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
