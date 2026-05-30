import { describe, it, expect } from 'vitest'
import { computeOverBudgetReconciliation } from './reconcile'

describe('computeOverBudgetReconciliation', () => {
  it('returns null when not over budget', () => {
    expect(
      computeOverBudgetReconciliation({ overBudgetAmount: 0, incomeVariance: 5000 })
    ).toBeNull()
    expect(
      computeOverBudgetReconciliation({ overBudgetAmount: -100, incomeVariance: 0 })
    ).toBeNull()
  })

  it('fully funded by unplanned income → positive tone with net-saved text', () => {
    const result = computeOverBudgetReconciliation({
      overBudgetAmount: 12319,
      incomeVariance: 21999
    })
    expect(result).not.toBeNull()
    expect(result?.tone).toBe('positive')
    expect(result?.text).toBe(
      'funded by +$21,999 unplanned income — net unplanned: +$9,680 saved'
    )
  })

  it('income variance exactly equals overage → positive tone, $0 saved', () => {
    const result = computeOverBudgetReconciliation({
      overBudgetAmount: 500,
      incomeVariance: 500
    })
    expect(result?.tone).toBe('positive')
    expect(result?.text).toContain('+$500 unplanned income')
    expect(result?.text).toContain('+$0 saved')
  })

  it('partial coverage → warning tone with unfunded amount', () => {
    const result = computeOverBudgetReconciliation({
      overBudgetAmount: 1000,
      incomeVariance: 400
    })
    expect(result?.tone).toBe('warning')
    expect(result?.text).toBe(
      '+$400 unplanned income partially covers — $600 unfunded overspend'
    )
  })

  it('no unplanned income (variance zero) → negative tone', () => {
    const result = computeOverBudgetReconciliation({
      overBudgetAmount: 750,
      incomeVariance: 0
    })
    expect(result?.tone).toBe('negative')
    expect(result?.text).toBe(
      'no unplanned income to cover — $750 truly over plan'
    )
  })

  it('income behind plan (negative variance) → negative tone', () => {
    const result = computeOverBudgetReconciliation({
      overBudgetAmount: 300,
      incomeVariance: -1500
    })
    expect(result?.tone).toBe('negative')
    expect(result?.text).toBe(
      'no unplanned income to cover — $300 truly over plan'
    )
  })
})
