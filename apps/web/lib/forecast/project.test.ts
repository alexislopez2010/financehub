import { describe, expect, it } from 'vitest'
import { project, projectDiscretionary, type ProjectBill, type StatTxn } from './project'
import type { SeasonalProfile } from './seasonalProfile'

const profile: SeasonalProfile = {
  baseline: [180, 170, 140, 90, 60, 45, 40, 40, 55, 90, 130, 175],
  source: 'import', years: 3, computed_at: '2026-06-21', note: ''
}

function bill(over: Partial<ProjectBill> = {}): ProjectBill {
  return {
    id: 'b1', name: 'Gas', tier: 'essential', category: 'Gas',
    budgetAmount: 100, isFixed: true, seasonalProfile: null, ...over
  }
}

const NO_TX: ReadonlyArray<StatTxn> = []

describe('project', () => {
  it('uses the seasonal profile when present (method seasonal-profile)', () => {
    const out = project({
      bills: [bill({ seasonalProfile: profile })],
      transactions: NO_TX, horizon: 3, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.method).toBe('seasonal-profile')
    expect(out[0]!.months.map(m => m.amount)).toEqual([180, 170, 140]) // Jan, Feb, Mar
  })

  it('wraps the calendar year across the horizon', () => {
    const out = project({
      bills: [bill({ seasonalProfile: profile })],
      transactions: NO_TX, horizon: 3, startYear: 2026, startMonth: 11
    })
    // Nov, Dec 2026 then Jan 2027
    expect(out[0]!.months.map(m => `${m.year}-${m.month}`)).toEqual(['2026-11', '2026-12', '2027-1'])
    expect(out[0]!.months.map(m => m.amount)).toEqual([130, 175, 180])
  })

  it('falls back to ledger calendar-month average for a variable bill with no profile (ledger-seasonal)', () => {
    const txns: StatTxn[] = [
      { date: '2025-01-10', amount: -200, type: 'Expense', category: 'Gas' },
      { date: '2024-01-10', amount: -160, type: 'Expense', category: 'Gas' }
    ]
    const out = project({
      bills: [bill({ isFixed: false, seasonalProfile: null })],
      transactions: txns, horizon: 1, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.method).toBe('ledger-seasonal')
    expect(out[0]!.months[0]!.amount).toBe(180) // (200+160)/2
  })

  it('projects a fixed bill flat at budgetAmount (method flat)', () => {
    const out = project({
      bills: [bill({ isFixed: true, budgetAmount: 2469.40, seasonalProfile: null })],
      transactions: NO_TX, horizon: 2, startYear: 2026, startMonth: 6
    })
    expect(out[0]!.method).toBe('flat')
    expect(out[0]!.months.map(m => m.amount)).toEqual([2469.40, 2469.40])
  })

  it('falls back to flat budgetAmount when variable bill has neither profile nor ledger history', () => {
    const out = project({
      bills: [bill({ isFixed: false, budgetAmount: 75, seasonalProfile: null })],
      transactions: NO_TX, horizon: 1, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.method).toBe('flat')
    expect(out[0]!.months[0]!.amount).toBe(75)
  })

  it('emits exactly `horizon` months per bill', () => {
    const out = project({
      bills: [bill({ seasonalProfile: profile })],
      transactions: NO_TX, horizon: 12, startYear: 2026, startMonth: 1
    })
    expect(out[0]!.months).toHaveLength(12)
  })
})

describe('projectDiscretionary', () => {
  it('repeats the trailing monthly average across the horizon (method trend)', () => {
    const txns: StatTxn[] = [
      { date: '2026-03-02', amount: -50, type: 'Expense', category: 'Dining' },
      { date: '2026-03-20', amount: -70, type: 'Expense', category: 'Dining' }, // Mar total 120
      { date: '2026-04-05', amount: -80, type: 'Expense', category: 'Dining' }  // Apr total 80
    ]
    const out = projectDiscretionary({
      categories: [{ name: 'Dining' }],
      transactions: txns, horizon: 3, startYear: 2026, startMonth: 5
    })
    expect(out[0]!.tier).toBe('discretionary')
    expect(out[0]!.method).toBe('trend')
    expect(out[0]!.billId).toBe('cat:Dining')
    // trailing avg over Mar+Apr = (120+80)/2 = 100, repeated 3x
    expect(out[0]!.months.map(m => m.amount)).toEqual([100, 100, 100])
  })

  it('projects 0 for a category with no spend in the window', () => {
    const out = projectDiscretionary({
      categories: [{ name: 'Hobbies' }],
      transactions: [], horizon: 2, startYear: 2026, startMonth: 5
    })
    expect(out[0]!.months.map(m => m.amount)).toEqual([0, 0])
  })

  it('emits one projection line per category', () => {
    const out = projectDiscretionary({
      categories: [{ name: 'Dining' }, { name: 'Shopping' }],
      transactions: [], horizon: 1, startYear: 2026, startMonth: 5
    })
    expect(out.map(p => p.category)).toEqual(['Dining', 'Shopping'])
  })
})
