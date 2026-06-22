import { describe, expect, it } from 'vitest'
import { monthlyPlannedIncome } from './projectIncome'

describe('monthlyPlannedIncome', () => {
  it('sums multiple sources within a month', () => {
    const income = monthlyPlannedIncome([
      { month: 1, expected_amount: 5000 },
      { month: 1, expected_amount: 3000 }
    ])
    expect(income).toBe(8000)
  })

  it('averages across months that have planned income', () => {
    const income = monthlyPlannedIncome([
      { month: 1, expected_amount: 8000 },
      { month: 2, expected_amount: 8000 },
      { month: 3, expected_amount: 8600 }
    ])
    // mean(8000, 8000, 8600) = 8200
    expect(income).toBe(8200)
  })

  it('ignores months with zero income so a partial plan is not dragged down', () => {
    const income = monthlyPlannedIncome([
      { month: 1, expected_amount: 8000 },
      { month: 2, expected_amount: 0 }
    ])
    expect(income).toBe(8000)
  })

  it('returns 0 when there is no planned income', () => {
    expect(monthlyPlannedIncome([])).toBe(0)
    expect(monthlyPlannedIncome([{ month: 1, expected_amount: 0 }])).toBe(0)
  })

  it('skips non-finite amounts', () => {
    const income = monthlyPlannedIncome([
      { month: 1, expected_amount: Number.NaN },
      { month: 1, expected_amount: 5000 }
    ])
    expect(income).toBe(5000)
  })
})
