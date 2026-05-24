import { describe, it, expect } from 'vitest'
import { queryKeys } from './keys'

describe('queryKeys', () => {
  it('transactions returns a stable single-element key without filters', () => {
    const a = queryKeys.transactions()
    const b = queryKeys.transactions()
    expect(a).toEqual(['transactions'])
    expect(a).toEqual(b)
  })

  it('transactions produces a different key per filter set', () => {
    const a = queryKeys.transactions({ startDate: '2025-05-01' })
    const b = queryKeys.transactions({ startDate: '2025-06-01' })
    expect(a).not.toEqual(b)
  })

  it('transactions with the same filter object produces equal keys', () => {
    const f = { startDate: '2025-05-01', endDate: '2025-05-31' }
    expect(queryKeys.transactions(f)).toEqual(queryKeys.transactions({ ...f }))
  })

  it('bills returns a constant single-element key', () => {
    expect(queryKeys.bills()).toEqual(['bills'])
  })

  it('billMatchRules returns a constant single-element key', () => {
    expect(queryKeys.billMatchRules()).toEqual(['billMatchRules'])
  })

  it('budgets includes year + month in the key', () => {
    expect(queryKeys.budgets({ year: 2025, month: 5 })).toEqual(['budgets', { year: 2025, month: 5 }])
    expect(queryKeys.budgets({ year: 2025, month: 5 })).not.toEqual(
      queryKeys.budgets({ year: 2025, month: 6 })
    )
  })

  it('accounts returns a constant single-element key', () => {
    expect(queryKeys.accounts()).toEqual(['accounts'])
  })

  it('categories returns a constant single-element key', () => {
    expect(queryKeys.categories()).toEqual(['categories'])
  })

  it('incomePlan includes year in the key', () => {
    expect(queryKeys.incomePlan({ year: 2025 })).toEqual(['incomePlan', { year: 2025 }])
    expect(queryKeys.incomePlan({ year: 2025 })).not.toEqual(queryKeys.incomePlan({ year: 2024 }))
  })

  it('allTransactions is the same prefix as transactions() — useful for invalidations', () => {
    expect(queryKeys.allTransactions()).toEqual(queryKeys.transactions())
  })
})
