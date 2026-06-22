import { describe, expect, it } from 'vitest'
import { proposeBudgets, type CurrentBudget } from './proposeBudgets'
import type { BillProjection } from './project'

function proj(category: string, month: number, amount: number, over: Partial<BillProjection> = {}): BillProjection {
  return {
    billId: 'b-' + category, billName: category, tier: 'essential', category,
    method: 'flat', months: [{ year: 2026, month, amount }], ...over
  }
}

describe('proposeBudgets', () => {
  it('proposes the projected amount per category for the target month', () => {
    const out = proposeBudgets({
      projections: [proj('Gas', 7, 45), proj('Housing', 7, 2469)],
      currentBudgets: [{ category: 'Gas', amount: 120 }],
      targetYear: 2026, targetMonth: 7
    })
    const gas = out.find(r => r.category === 'Gas')!
    expect(gas.proposed).toBe(45)
    expect(gas.current).toBe(120)
    expect(gas.delta).toBe(-75)
    const housing = out.find(r => r.category === 'Housing')!
    expect(housing.current).toBe(0)    // no current budget row
    expect(housing.proposed).toBe(2469)
    expect(housing.delta).toBe(2469)
  })

  it('sums multiple bills that map to the same category', () => {
    const out = proposeBudgets({
      projections: [proj('Software & Apps', 7, 20), proj('Software & Apps', 7, 30, { billId: 'b2' })],
      currentBudgets: [],
      targetYear: 2026, targetMonth: 7
    })
    expect(out.find(r => r.category === 'Software & Apps')!.proposed).toBe(50)
  })

  it('ignores projection months that are not the target month', () => {
    const out = proposeBudgets({
      projections: [{
        billId: 'b', billName: 'Gas', tier: 'essential', category: 'Gas', method: 'flat',
        months: [{ year: 2026, month: 6, amount: 999 }, { year: 2026, month: 7, amount: 45 }]
      }],
      currentBudgets: [], targetYear: 2026, targetMonth: 7
    })
    expect(out.find(r => r.category === 'Gas')!.proposed).toBe(45)
  })

  it('skips projections with a null category', () => {
    const out = proposeBudgets({
      projections: [{ billId: 'b', billName: 'X', tier: 'essential', category: null, method: 'flat',
        months: [{ year: 2026, month: 7, amount: 10 }] }],
      currentBudgets: [], targetYear: 2026, targetMonth: 7
    })
    expect(out).toEqual([])
  })

  it('sorts results by category name', () => {
    const out = proposeBudgets({
      projections: [proj('Zeta', 7, 1), proj('Alpha', 7, 1)],
      currentBudgets: [], targetYear: 2026, targetMonth: 7
    })
    expect(out.map(r => r.category)).toEqual(['Alpha', 'Zeta'])
  })
})
