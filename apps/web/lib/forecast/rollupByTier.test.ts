import { describe, expect, it } from 'vitest'
import { rollupByTier } from './rollupByTier'
import type { BillProjection } from './project'

function proj(over: Partial<BillProjection>): BillProjection {
  return {
    billId: 'b', billName: 'B', tier: 'essential', category: 'C',
    method: 'flat',
    months: [{ year: 2026, month: 1, amount: 100 }, { year: 2026, month: 2, amount: 100 }],
    ...over
  }
}

describe('rollupByTier', () => {
  it('sums per-tier per-month totals across bills', () => {
    const out = rollupByTier([
      proj({ tier: 'essential', months: [{ year: 2026, month: 1, amount: 100 }, { year: 2026, month: 2, amount: 120 }] }),
      proj({ tier: 'essential', months: [{ year: 2026, month: 1, amount: 50 },  { year: 2026, month: 2, amount: 50 }] }),
      proj({ tier: 'services',  months: [{ year: 2026, month: 1, amount: 30 },  { year: 2026, month: 2, amount: 30 }] })
    ])
    expect(out.essential).toEqual([
      { year: 2026, month: 1, amount: 150 },
      { year: 2026, month: 2, amount: 170 }
    ])
    expect(out.services).toEqual([
      { year: 2026, month: 1, amount: 30 },
      { year: 2026, month: 2, amount: 30 }
    ])
    expect(out.discretionary).toEqual([])
  })

  it('returns empty arrays for all tiers when given no projections', () => {
    const out = rollupByTier([])
    expect(out).toEqual({ essential: [], services: [], discretionary: [] })
  })

  it('keeps months in chronological order', () => {
    const out = rollupByTier([
      proj({ tier: 'services', months: [
        { year: 2026, month: 12, amount: 10 },
        { year: 2027, month: 1, amount: 20 }
      ] })
    ])
    expect(out.services.map(m => `${m.year}-${m.month}`)).toEqual(['2026-12', '2027-1'])
  })
})
