import { describe, it, expect } from 'vitest'
import { simulatePayoff, orderDebts } from './debt'
import type { DebtRow } from './types'

const HID = '00000000-0000-0000-0000-000000000001'

function debt(over: Partial<DebtRow> = {}): DebtRow {
  return {
    id: 'd1',
    household_id: HID,
    name: 'Test Debt',
    balance: 1000,
    apr: 0,
    min_payment: 100,
    escrow: 0,
    is_active: true,
    ...over
  }
}

describe('orderDebts', () => {
  const d1 = { id: 'd1', name: 'CC', balance: 5000, apr: 18 }
  const d2 = { id: 'd2', name: 'AA', balance: 1000, apr: 22 }
  const d3 = { id: 'd3', name: 'BB', balance: 3000, apr: 12 }

  it('snowball: ascending balance', () => {
    const o = orderDebts([d1, d2, d3], 'snowball')
    expect(o.map(d => d.id)).toEqual(['d2', 'd3', 'd1'])
  })

  it('avalanche: descending APR', () => {
    const o = orderDebts([d1, d2, d3], 'avalanche')
    expect(o.map(d => d.id)).toEqual(['d2', 'd1', 'd3'])
  })

  it('minimum_only: preserves input order', () => {
    const o = orderDebts([d1, d2, d3], 'minimum_only')
    expect(o.map(d => d.id)).toEqual(['d1', 'd2', 'd3'])
  })

  it('snowball: ties broken by name', () => {
    const a = { id: 'a', name: 'Bravo', balance: 100, apr: 5 }
    const b = { id: 'b', name: 'Alpha', balance: 100, apr: 5 }
    const o = orderDebts([a, b], 'snowball')
    expect(o.map(d => d.id)).toEqual(['b', 'a'])
  })
})

describe('simulatePayoff — short-circuits', () => {
  it('returns empty plan for no debts', () => {
    const plan = simulatePayoff([], { strategy: 'snowball', extraPerMonth: 0 })
    expect(plan.paidOff).toBe(true)
    expect(plan.months).toHaveLength(0)
    expect(plan.monthsToPayoff).toBe(0)
  })

  it('returns empty plan when all debts are inactive', () => {
    const plan = simulatePayoff([debt({ is_active: false })], { strategy: 'snowball', extraPerMonth: 0 })
    expect(plan.paidOff).toBe(true)
    expect(plan.months).toHaveLength(0)
  })

  it('marks already-zero-balance debts as paid in month 0', () => {
    const plan = simulatePayoff([debt({ id: 'd1', balance: 0 })], { strategy: 'snowball', extraPerMonth: 0 })
    expect(plan.paidOffByMonth['d1']).toBe(0)
    expect(plan.paidOff).toBe(true)
  })
})

describe('simulatePayoff — minimum_only', () => {
  it('pays balance/min_payment months for 0% APR', () => {
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 100, apr: 0 })],
      { strategy: 'minimum_only', extraPerMonth: 999 }  // extra ignored in min_only
    )
    expect(plan.paidOff).toBe(true)
    expect(plan.monthsToPayoff).toBe(10)
    expect(plan.totalInterest).toBe(0)
  })

  it('ignores extraPerMonth in minimum_only strategy', () => {
    // With extra=100, balance 1000/(100+100)=5 months. With min_only=10 months.
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 100, apr: 0 })],
      { strategy: 'minimum_only', extraPerMonth: 100 }
    )
    expect(plan.monthsToPayoff).toBe(10)
  })
})

describe('simulatePayoff — escrow regression (commit 3449765)', () => {
  it('escrow does NOT reduce principal — escrow is "wasted" toward payoff', () => {
    // $1000 balance, $200 min_payment of which $100 is escrow.
    // Each month: $100 reduces principal, $100 is escrow (not principal).
    // 1000 / 100 = 10 months.
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 200, escrow: 100, apr: 0 })],
      { strategy: 'snowball', extraPerMonth: 0 }
    )
    expect(plan.monthsToPayoff).toBe(10)
  })

  it('if escrow == min_payment, principal never reduces (and we hit maxMonths)', () => {
    // All payment is escrow → 0 principal reduction → never pays off.
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 100, escrow: 100, apr: 0 })],
      { strategy: 'snowball', extraPerMonth: 0, maxMonths: 12 }
    )
    expect(plan.paidOff).toBe(false)
    expect(plan.months).toHaveLength(12)
  })

  it('escrow clamped when greater than min_payment', () => {
    const plan = simulatePayoff(
      [debt({ balance: 100, min_payment: 50, escrow: 999, apr: 0 })],
      { strategy: 'snowball', extraPerMonth: 0, maxMonths: 12 }
    )
    // All $50 of min_payment is escrow → no principal payment → never pays off.
    expect(plan.paidOff).toBe(false)
  })
})

describe('simulatePayoff — extra payment routing', () => {
  it('snowball: extra goes to smallest balance first', () => {
    const d = [
      debt({ id: 'big',   name: 'Big',   balance: 5000, min_payment: 100, apr: 0 }),
      debt({ id: 'small', name: 'Small', balance: 1000, min_payment: 100, apr: 0 })
    ]
    const plan = simulatePayoff(d, { strategy: 'snowball', extraPerMonth: 400 })
    // Small: 1000/(100+400) = 2 months.
    // After small paid, big has been paying 100/mo for 2 months → balance = 5000 - 200 = 4800.
    // Then extra=400 goes to big → 500/mo. 4800/500 = 9.6 → 10 months more.
    // Total: 2 + 10 = 12 months.
    expect(plan.paidOffByMonth['small']).toBe(2)
    expect(plan.monthsToPayoff).toBeLessThanOrEqual(12)
  })

  it('avalanche: extra goes to highest APR first', () => {
    const d = [
      debt({ id: 'lowapr',  name: 'Low',  balance: 1000, min_payment: 50, apr: 5 }),
      debt({ id: 'highapr', name: 'High', balance: 1000, min_payment: 50, apr: 25 })
    ]
    const plan = simulatePayoff(d, { strategy: 'avalanche', extraPerMonth: 200 })
    // Extra targets highapr first → highapr paid off before lowapr.
    expect(plan.paidOffByMonth['highapr']).toBeLessThan(plan.paidOffByMonth['lowapr']!)
  })

  it('extra cascades to next debt when first debt is paid off mid-month', () => {
    const d = [
      debt({ id: 'small', name: 'Small', balance: 100, min_payment: 50, apr: 0 }),
      debt({ id: 'big',   name: 'Big',   balance: 1000, min_payment: 100, apr: 0 })
    ]
    // Month 1: small min=50, big min=100. Extra=$200.
    //   Small: pay 50 min, then 50 of extra clears it.
    //   Remaining extra (150) cascades to big: 100 min + 150 extra = 250 paid.
    //   Big balance: 1000 - 250 = 750.
    // Month 2: small paid; big min=100 + extra=200 = 300. Balance 750-300=450.
    // Month 3: 450 - 300 = 150.
    // Month 4: 150 - 300 = -150 → 0.
    const plan = simulatePayoff(d, { strategy: 'snowball', extraPerMonth: 200 })
    expect(plan.paidOffByMonth['small']).toBe(1)
    expect(plan.paidOffByMonth['big']).toBe(4)
  })
})

describe('simulatePayoff — interest', () => {
  it('zero APR → totalInterest is zero', () => {
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 100, apr: 0 })],
      { strategy: 'snowball', extraPerMonth: 0 }
    )
    expect(plan.totalInterest).toBe(0)
  })

  it('positive APR adds interest each month', () => {
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 100, apr: 24 })],  // 2% / month
      { strategy: 'snowball', extraPerMonth: 0 }
    )
    expect(plan.totalInterest).toBeGreaterThan(0)
    expect(plan.paidOff).toBe(true)
  })

  it('interest is applied after principal payment', () => {
    // Month 1: balance 1000, pay 100 principal → balance 900. Interest = 900 * 0.02 = 18.
    // End of month balance: 918.
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 100, apr: 24 })],
      { strategy: 'snowball', extraPerMonth: 0 }
    )
    const m1 = plan.months[0]!.perDebt[0]!
    expect(m1.principal).toBe(100)
    expect(m1.interest).toBeCloseTo(18, 2)
    expect(m1.balance).toBeCloseTo(918, 2)
  })
})

describe('simulatePayoff — maxMonths safety', () => {
  it('terminates at maxMonths when payoff would take longer', () => {
    // Min payment less than monthly interest → balance grows forever.
    const plan = simulatePayoff(
      [debt({ balance: 1000, min_payment: 1, apr: 100 })],  // ~8% / month
      { strategy: 'snowball', extraPerMonth: 0, maxMonths: 12 }
    )
    expect(plan.paidOff).toBe(false)
    expect(plan.months).toHaveLength(12)
    expect(plan.monthsToPayoff).toBe(12)
  })

  it('uses default 600 months when maxMonths not specified', () => {
    const plan = simulatePayoff(
      [debt({ balance: 1, min_payment: 0, apr: 100 })],  // pays 0 principal forever
      { strategy: 'snowball', extraPerMonth: 0 }
    )
    expect(plan.months.length).toBe(600)
  })
})

describe('simulatePayoff — extraPerMonth normalization', () => {
  it('negative extra is treated as 0', () => {
    const plan = simulatePayoff(
      [debt({ balance: 100, min_payment: 100, apr: 0 })],
      { strategy: 'snowball', extraPerMonth: -50 }
    )
    expect(plan.monthsToPayoff).toBe(1)
    expect(plan.totalPaid).toBe(100)
  })
})

describe('simulatePayoff — multi-debt totals', () => {
  it('totalPaid equals sum of all month payments', () => {
    const d = [
      debt({ id: 'd1', balance: 500, min_payment: 50, apr: 0 }),
      debt({ id: 'd2', balance: 500, min_payment: 50, apr: 0 })
    ]
    const plan = simulatePayoff(d, { strategy: 'snowball', extraPerMonth: 0 })
    const sumOfMonthPayments = plan.months.reduce((s, m) => s + m.totalPayment, 0)
    expect(plan.totalPaid).toBeCloseTo(sumOfMonthPayments, 2)
  })
})
