import { describe, it, expect } from 'vitest'
import { forecast30Day, parseISODate, formatISODate, addDay } from './forecast'
import type { TransactionRow, BillRow, IncomePlanRow } from './types'

const HID = '00000000-0000-0000-0000-000000000001'

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: HID,
    date: '2025-05-15',
    description: 'test',
    amount: 100,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    member: null,
    transfer_pair_id: null,
    ...over
  }
}

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    household_id: HID,
    name: 'Test Bill',
    category: null,
    account: null,
    due_day: 15,
    frequency: 'Monthly',
    budget_amount: 200,
    is_active: true,
    notes: null,
    ...over
  }
}

function plan(over: Partial<IncomePlanRow> = {}): IncomePlanRow {
  return {
    id: 'p1',
    household_id: HID,
    source: 'Employer',
    member: 'Alexis',
    year: 2025,
    month: 5,
    expected_amount: 5000,
    is_active: true,
    ...over
  }
}

describe('parseISODate / formatISODate / addDay', () => {
  it('parses a valid ISO date', () => {
    expect(parseISODate('2025-05-15')).toEqual({ year: 2025, month: 5, day: 15 })
  })

  it('throws on invalid format', () => {
    expect(() => parseISODate('2025/05/15')).toThrow(RangeError)
    expect(() => parseISODate('05-15-2025')).toThrow(RangeError)
    expect(() => parseISODate('not a date')).toThrow(RangeError)
  })

  it('round-trips format ↔ parse', () => {
    const d = { year: 2025, month: 7, day: 4 }
    expect(parseISODate(formatISODate(d))).toEqual(d)
  })

  it('addDay increments within month', () => {
    expect(addDay({ year: 2025, month: 5, day: 15 })).toEqual({ year: 2025, month: 5, day: 16 })
  })

  it('addDay rolls over month boundary', () => {
    expect(addDay({ year: 2025, month: 5, day: 31 })).toEqual({ year: 2025, month: 6, day: 1 })
  })

  it('addDay rolls over year boundary', () => {
    expect(addDay({ year: 2025, month: 12, day: 31 })).toEqual({ year: 2026, month: 1, day: 1 })
  })

  it('addDay handles Feb 28 in non-leap year', () => {
    expect(addDay({ year: 2025, month: 2, day: 28 })).toEqual({ year: 2025, month: 3, day: 1 })
  })

  it('addDay handles Feb 29 in leap year', () => {
    expect(addDay({ year: 2024, month: 2, day: 29 })).toEqual({ year: 2024, month: 3, day: 1 })
  })
})

describe('forecast30Day — empty inputs', () => {
  it('returns exactly `days` points with no activity', () => {
    const out = forecast30Day([], [], [], { startBalance: 1000, startDate: '2025-05-01', days: 5 })
    expect(out).toHaveLength(5)
    expect(out.every(p => p.balance === 1000 && p.netChange === 0)).toBe(true)
  })

  it('defaults to 30 days when days omitted', () => {
    const out = forecast30Day([], [], [], { startBalance: 0, startDate: '2025-05-01' })
    expect(out).toHaveLength(30)
  })

  it('returns empty when days <= 0', () => {
    expect(forecast30Day([], [], [], { startBalance: 0, startDate: '2025-05-01', days: 0 })).toEqual([])
    expect(forecast30Day([], [], [], { startBalance: 0, startDate: '2025-05-01', days: -5 })).toEqual([])
  })

  it('every point has the correct ISO date sequence', () => {
    const out = forecast30Day([], [], [], { startBalance: 0, startDate: '2025-05-30', days: 3 })
    expect(out.map(p => p.date)).toEqual(['2025-05-30', '2025-05-31', '2025-06-01'])
  })
})

describe('forecast30Day — transactions', () => {
  it('applies Income on its date', () => {
    const t = tx({ date: '2025-05-01', amount: 500, type: 'Income' })
    const out = forecast30Day([t], [], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.inflow).toBe(500)
    expect(out[0]!.balance).toBe(1500)
  })

  it('applies Expense as a negative on its date', () => {
    const t = tx({ date: '2025-05-01', amount: 200, type: 'Expense' })
    const out = forecast30Day([t], [], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.outflow).toBe(200)
    expect(out[0]!.balance).toBe(800)
  })

  it('applies Refund as a positive on its date', () => {
    const t = tx({ date: '2025-05-01', amount: 50, type: 'Refund' })
    const out = forecast30Day([t], [], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.inflow).toBe(50)
    expect(out[0]!.balance).toBe(1050)
  })

  it('uses raw signed amount for Transfer (regression from commit 83a1827)', () => {
    // Transfer pair: -300 leaves source account, +300 enters destination account.
    // From the perspective of a single-account forecast, only one leg's account
    // is relevant — but forecast30Day treats all transactions equally. With
    // a paired transfer, the two cancel out. With a legacy single-row transfer,
    // its raw sign is applied.
    const t1 = tx({ id: 't1', date: '2025-05-01', amount: -300, type: 'Transfer' })
    const t2 = tx({ id: 't2', date: '2025-05-01', amount: 300, type: 'Transfer' })
    const out = forecast30Day([t1, t2], [], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.balance).toBe(1000)  // net zero
  })

  it('applies multiple transactions on the same day', () => {
    const txs = [
      tx({ id: 'a', date: '2025-05-01', amount: 100, type: 'Income' }),
      tx({ id: 'b', date: '2025-05-01', amount: 40, type: 'Expense' }),
      tx({ id: 'c', date: '2025-05-01', amount: 20, type: 'Refund' })
    ]
    const out = forecast30Day(txs, [], [], { startBalance: 0, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.inflow).toBe(120)  // 100 + 20
    expect(out[0]!.outflow).toBe(40)
    expect(out[0]!.balance).toBe(80)
  })

  it('skips transactions outside the forecast window', () => {
    const txs = [
      tx({ id: 'before', date: '2025-04-30', amount: 999, type: 'Income' }),
      tx({ id: 'in', date: '2025-05-01', amount: 100, type: 'Income' }),
      tx({ id: 'after', date: '2025-05-03', amount: 999, type: 'Income' })
    ]
    const out = forecast30Day(txs, [], [], { startBalance: 0, startDate: '2025-05-01', days: 2 })
    expect(out[0]!.inflow).toBe(100)
    expect(out[1]!.inflow).toBe(0)
  })
})

describe('forecast30Day — bills', () => {
  it('subtracts an active monthly bill on its due day', () => {
    const b = bill({ due_day: 1, budget_amount: 100, is_active: true })
    const out = forecast30Day([], [b], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.outflow).toBe(100)
    expect(out[0]!.balance).toBe(900)
  })

  it('skips inactive bills', () => {
    const b = bill({ due_day: 1, budget_amount: 100, is_active: false })
    const out = forecast30Day([], [b], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.balance).toBe(1000)
  })

  it('skips bills with null due_day', () => {
    const b = bill({ due_day: null, budget_amount: 100 })
    const out = forecast30Day([], [b], [], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.balance).toBe(1000)
  })

  it('clamps day=31 bills to last day of month', () => {
    const b = bill({ due_day: 31, budget_amount: 100 })
    // Feb has 28 days in 2025 → bill due on Feb 28.
    const out = forecast30Day([], [b], [], { startBalance: 1000, startDate: '2025-02-01', days: 28 })
    expect(out[27]!.date).toBe('2025-02-28')
    expect(out[27]!.outflow).toBe(100)
  })

  it('applies the bill again each month it falls in the window', () => {
    const b = bill({ due_day: 15, budget_amount: 100 })
    // Window: May 1 to Jun 30 (60 days). Should hit May 15 + Jun 15.
    const out = forecast30Day([], [b], [], { startBalance: 1000, startDate: '2025-05-01', days: 60 })
    expect(out.find(p => p.date === '2025-05-15')!.outflow).toBe(100)
    expect(out.find(p => p.date === '2025-06-15')!.outflow).toBe(100)
    expect(out[out.length - 1]!.balance).toBe(800)  // 1000 - 200
  })
})

describe('forecast30Day — income plan', () => {
  it('credits a monthly plan on the 1st of its month', () => {
    const p = plan({ year: 2025, month: 5, expected_amount: 5000, cadence: 'monthly' })
    const out = forecast30Day([], [], [p], { startBalance: 0, startDate: '2025-05-01', days: 5 })
    expect(out[0]!.inflow).toBe(5000)
    expect(out[1]!.inflow).toBe(0)
  })

  it('credits semimonthly plan on the 1st and 15th', () => {
    const p = plan({ year: 2025, month: 5, expected_amount: 4000, cadence: 'semimonthly' })
    const out = forecast30Day([], [], [p], { startBalance: 0, startDate: '2025-05-01', days: 16 })
    expect(out[0]!.inflow).toBe(2000)
    expect(out[14]!.date).toBe('2025-05-15')
    expect(out[14]!.inflow).toBe(2000)
  })

  it('treats null cadence as monthly', () => {
    const p = plan({ cadence: null, expected_amount: 5000 })
    const out = forecast30Day([], [], [p], { startBalance: 0, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.inflow).toBe(5000)
  })

  it('skips inactive plans', () => {
    const p = plan({ is_active: false, expected_amount: 5000 })
    const out = forecast30Day([], [], [p], { startBalance: 0, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.inflow).toBe(0)
  })

  it('skips plans for other year/month', () => {
    const p = plan({ year: 2024, month: 5 })
    const out = forecast30Day([], [], [p], { startBalance: 0, startDate: '2025-05-01', days: 1 })
    expect(out[0]!.inflow).toBe(0)
  })

  it('applies multiple plan months across the window', () => {
    const plans = [
      plan({ id: 'p1', year: 2025, month: 5, expected_amount: 5000 }),
      plan({ id: 'p2', year: 2025, month: 6, expected_amount: 5500 })
    ]
    const out = forecast30Day([], [], plans, { startBalance: 0, startDate: '2025-05-01', days: 35 })
    expect(out[0]!.inflow).toBe(5000)
    const jun1 = out.find(p => p.date === '2025-06-01')!
    expect(jun1.inflow).toBe(5500)
  })
})

describe('forecast30Day — composition', () => {
  it('balance flows through across days', () => {
    const txs = [
      tx({ id: 'a', date: '2025-05-01', amount: 100, type: 'Income' }),
      tx({ id: 'b', date: '2025-05-03', amount: 50, type: 'Expense' })
    ]
    const out = forecast30Day(txs, [], [], { startBalance: 1000, startDate: '2025-05-01', days: 4 })
    expect(out.map(p => p.balance)).toEqual([1100, 1100, 1050, 1050])
  })

  it('combines transactions + bills + income on the same day', () => {
    const t = tx({ date: '2025-05-01', amount: 200, type: 'Income' })
    const b = bill({ due_day: 1, budget_amount: 100 })
    const p = plan({ year: 2025, month: 5, expected_amount: 5000, cadence: 'monthly' })
    const out = forecast30Day([t], [b], [p], { startBalance: 1000, startDate: '2025-05-01', days: 1 })
    // inflow: 200 (tx) + 5000 (income plan) = 5200
    // outflow: 100 (bill)
    // balance: 1000 + 5100 = 6100
    expect(out[0]!.inflow).toBe(5200)
    expect(out[0]!.outflow).toBe(100)
    expect(out[0]!.balance).toBe(6100)
  })

  it('forecast across a year boundary works correctly', () => {
    const b = bill({ due_day: 1, budget_amount: 50 })
    const out = forecast30Day([], [b], [], { startBalance: 100, startDate: '2025-12-30', days: 5 })
    expect(out.map(p => p.date)).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03'])
    expect(out[2]!.outflow).toBe(50)  // bill on Jan 1
  })
})
