import { describe, it, expect } from 'vitest'
import { computePlanIncome } from './income'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

function plan(over: Partial<{ month: number; expected_amount: number; source: string }> = {}) {
  return {
    id: 'p',
    household_id: HOUSEHOLD,
    year: 2025,
    month: 5,
    source: 'Acme Payroll',
    member: 'Alexis',
    expected_amount: 5000,
    frequency: 'monthly',
    is_active: true,
    created_at: null,
    ...over
  }
}

function tx(over: Partial<{ id: string; amount: number; description: string; date: string; type: string }> = {}) {
  return {
    id: 't',
    household_id: HOUSEHOLD,
    date: '2025-05-15',
    description: 'ACME PAYROLL deposit',
    amount: 5000,
    type: 'Income',
    category: null,
    category_id: null,
    account: null,
    account_id: null,
    created_at: null,
    fingerprint: null,
    imported_at: null,
    member: null,
    notes: null,
    transfer_pair_id: null,
    updated_at: null,
    ...over
  }
}

describe('computePlanIncome', () => {
  it('sums planned income only for the period month', () => {
    const result = computePlanIncome({
      plans: [
        plan({ month: 5, expected_amount: 5000 }),
        plan({ month: 5, expected_amount: 2000, source: 'Side Gig' }),
        plan({ month: 6, expected_amount: 1000 }) // wrong month, excluded
      ],
      transactions: [],
      period: { year: 2025, month: 5 }
    })
    expect(result.plannedIncome).toBe(7000)
    expect(result.actualIncome).toBe(0)
  })

  it('sums actualIncome from matched income transactions', () => {
    const result = computePlanIncome({
      plans: [plan({ source: 'Acme Payroll', expected_amount: 5000 })],
      transactions: [
        tx({ description: 'ACME PAYROLL deposit', amount: 5000 }),
        tx({ id: 't2', description: 'ACME PAYROLL bonus', amount: 1500 })
      ],
      period: { year: 2025, month: 5 }
    })
    expect(result.plannedIncome).toBe(5000)
    expect(result.actualIncome).toBe(6500)
  })

  it('returns zeros when no plans and no transactions', () => {
    const result = computePlanIncome({
      plans: [],
      transactions: [],
      period: { year: 2025, month: 5 }
    })
    expect(result).toEqual({ plannedIncome: 0, actualIncome: 0 })
  })
})
