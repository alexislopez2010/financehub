/**
 * Aggregate per-bill projections into per-tier, per-month totals — the shape
 * the Forecast chart + tier headers consume.
 */

import type { BillProjection, MonthlyProjection } from './project'
import type { SpendTier } from './tier'
import { round2, monthIndex } from './utils'

export interface TierRollup {
  essential: ReadonlyArray<MonthlyProjection>
  services: ReadonlyArray<MonthlyProjection>
  discretionary: ReadonlyArray<MonthlyProjection>
}

function rollupOne(projections: ReadonlyArray<BillProjection>, tier: SpendTier): MonthlyProjection[] {
  const byMonth = new Map<number, MonthlyProjection>()
  for (const proj of projections) {
    if (proj.tier !== tier) continue
    for (const m of proj.months) {
      const key = monthIndex(m)
      const existing = byMonth.get(key)
      // Immutable update — replace the cell rather than mutating it in place.
      byMonth.set(key, existing
        ? { ...existing, amount: round2(existing.amount + m.amount) }
        : { year: m.year, month: m.month, amount: round2(m.amount) })
    }
  }
  return [...byMonth.values()].sort((a, b) => monthIndex(a) - monthIndex(b))
}

export function rollupByTier(projections: ReadonlyArray<BillProjection>): TierRollup {
  return {
    essential: rollupOne(projections, 'essential'),
    services: rollupOne(projections, 'services'),
    discretionary: rollupOne(projections, 'discretionary')
  }
}
