import { describe, it, expect } from 'vitest'
import { sourceKeywords, transactionMatchesSource, matchIncome } from './incomeMatching'
import type { IncomePlanRow, TransactionRow } from './types'

const HID = '00000000-0000-0000-0000-000000000001'

function plan(over: Partial<IncomePlanRow> = {}): IncomePlanRow {
  return {
    id: 'p1',
    household_id: HID,
    source: 'Omnicom Shared Services',
    member: 'Alexis',
    year: 2025,
    month: 5,
    expected_amount: 5000,
    is_active: true,
    ...over
  }
}

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: HID,
    date: '2025-05-15',
    description: 'OMNICOM SHARED SERVICES PAYROLL',
    amount: 5000,
    type: 'Income',
    category: null,
    category_id: null,
    account: 'Chase Checking',
    member: null,
    transfer_pair_id: null,
    ...over
  }
}

describe('sourceKeywords', () => {
  it('splits on whitespace and lowercases', () => {
    expect(sourceKeywords('Omnicom Shared Services')).toEqual(['omnicom', 'shared', 'services'])
  })

  it('drops punctuation', () => {
    expect(sourceKeywords('J. Crew Group, Inc.')).toEqual(['j', 'crew', 'group', 'inc'])
  })

  it('returns empty for empty input', () => {
    expect(sourceKeywords('')).toEqual([])
  })

  it('returns empty for punctuation-only input', () => {
    expect(sourceKeywords('!!! --- ...')).toEqual([])
  })

  it('preserves digits', () => {
    expect(sourceKeywords('Box 401k')).toEqual(['box', '401k'])
  })
})

describe('transactionMatchesSource', () => {
  it('matches when ANY keyword is a substring of the description', () => {
    expect(transactionMatchesSource(tx({ description: 'OMNICOM PAYROLL' }), ['omnicom', 'shared'])).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(transactionMatchesSource(tx({ description: 'omnicom payroll' }), ['OMNICOM'])).toBe(true)
    expect(transactionMatchesSource(tx({ description: 'OMNICOM payroll' }), ['omnicom'])).toBe(true)
  })

  it('returns false when keywords is empty', () => {
    expect(transactionMatchesSource(tx({ description: 'anything' }), [])).toBe(false)
  })

  it('returns false when description is empty', () => {
    expect(transactionMatchesSource(tx({ description: '' }), ['omnicom'])).toBe(false)
  })

  it('returns false when no keyword matches', () => {
    expect(transactionMatchesSource(tx({ description: 'NETFLIX' }), ['omnicom'])).toBe(false)
  })
})

describe('matchIncome', () => {
  const opts = { year: 2025, months: [5] }

  it('returns empty when there are no plans and no transactions', () => {
    expect(matchIncome([], [], opts)).toEqual([])
  })

  it('returns plan with planned amount and zero actual when no transactions match', () => {
    const results = matchIncome([plan()], [], opts)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      source: 'Omnicom Shared Services',
      planned: 5000,
      actual: 0
    })
    expect(results[0]!.members).toEqual(['Alexis'])
    expect(results[0]!.transactions).toEqual([])
  })

  it('aggregates planned across multiple members under the same source', () => {
    const plans = [
      plan({ id: 'p1', member: 'Alexis', expected_amount: 5000 }),
      plan({ id: 'p2', member: 'Marilyn', expected_amount: 3000 })
    ]
    const results = matchIncome(plans, [], opts)
    expect(results).toHaveLength(1)
    expect(results[0]!.planned).toBe(8000)
    expect([...results[0]!.members].sort()).toEqual(['Alexis', 'Marilyn'])
  })

  it('matches Income transactions to their source by keyword', () => {
    const results = matchIncome([plan()], [tx()], opts)
    expect(results[0]!.actual).toBe(5000)
    expect(results[0]!.transactions.map(t => t.id)).toEqual(['t1'])
  })

  it('first-match-wins when multiple sources could match (regression from commit f5b5d4e)', () => {
    // Both "Shared Services Co" and "Omnicom Shared" would match the description
    // "OMNICOM SHARED SERVICES PAYROLL" since they share the "shared" keyword.
    // Per first-match-wins, the order of plans determines the winner.
    const plans = [
      plan({ id: 'p1', source: 'Omnicom Shared', expected_amount: 4000, member: null }),
      plan({ id: 'p2', source: 'Shared Services Co', expected_amount: 3000, member: null })
    ]
    const t = tx({ description: 'OMNICOM SHARED SERVICES PAYROLL' })
    const results = matchIncome(plans, [t], opts)
    expect(results).toHaveLength(2)
    expect(results[0]!.source).toBe('Omnicom Shared')
    expect(results[0]!.actual).toBe(5000)
    expect(results[1]!.source).toBe('Shared Services Co')
    expect(results[1]!.actual).toBe(0)
  })

  it('skips inactive plan rows', () => {
    const plans = [plan({ is_active: false })]
    const results = matchIncome(plans, [tx()], opts)
    // No active plan → no source aggregation. The Income transaction is unmatched
    // and lands under Uncategorized.
    expect(results).toHaveLength(1)
    expect(results[0]!.source).toBe('Uncategorized')
    expect(results[0]!.actual).toBe(5000)
  })

  it('filters plan rows by year and month', () => {
    const plans = [
      plan({ id: 'p1', year: 2024, month: 5, expected_amount: 5000 }),
      plan({ id: 'p2', year: 2025, month: 4, expected_amount: 5000 }),
      plan({ id: 'p3', year: 2025, month: 5, expected_amount: 5000 })
    ]
    const results = matchIncome(plans, [], opts)
    expect(results[0]!.planned).toBe(5000)  // only p3 in May 2025
  })

  it('filters Income transactions by year and month', () => {
    const plans = [plan()]
    const txs = [
      tx({ id: 't1', date: '2025-04-30', description: 'OMNICOM' }),  // wrong month
      tx({ id: 't2', date: '2025-05-15', description: 'OMNICOM' }),  // in
      tx({ id: 't3', date: '2025-06-01', description: 'OMNICOM' })   // wrong month
    ]
    const results = matchIncome(plans, txs, opts)
    expect(results[0]!.transactions.map(t => t.id)).toEqual(['t2'])
  })

  it('ignores non-Income transactions even when description matches', () => {
    const plans = [plan()]
    const txs = [tx({ type: 'Expense' })]
    const results = matchIncome(plans, txs, opts)
    expect(results[0]!.transactions).toHaveLength(0)
  })

  it('returns Uncategorized source for unmatched Income transactions', () => {
    const plans = [plan({ source: 'Specific Employer' })]
    const txs = [
      tx({ id: 't1', description: 'SPECIFIC EMPLOYER PAYROLL' }),  // matches plan
      tx({ id: 't2', description: 'Mystery deposit', amount: 100 }) // doesn't match
    ]
    const results = matchIncome(plans, txs, opts)
    expect(results).toHaveLength(2)
    expect(results[0]!.source).toBe('Specific Employer')
    expect(results[0]!.actual).toBe(5000)
    expect(results[1]!.source).toBe('Uncategorized')
    expect(results[1]!.actual).toBe(100)
    expect(results[1]!.transactions.map(t => t.id)).toEqual(['t2'])
  })

  it('omits Uncategorized when every Income tx matches a source', () => {
    const plans = [plan()]
    const results = matchIncome(plans, [tx()], opts)
    expect(results.find(r => r.source === 'Uncategorized')).toBeUndefined()
  })

  it('YTD: multiple months pulls all of them', () => {
    const optsYtd = { year: 2025, months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
    const plans = [
      plan({ id: 'p1', month: 1, expected_amount: 5000 }),
      plan({ id: 'p2', month: 6, expected_amount: 5500 })
    ]
    const results = matchIncome(plans, [], optsYtd)
    expect(results[0]!.planned).toBe(10500)
  })

  it('treats null source as "Other"', () => {
    const plans = [plan({ source: null, member: null })]
    const results = matchIncome(plans, [], opts)
    expect(results[0]!.source).toBe('Other')
  })

  it('uses absolute values for actual (handles negative income corrections)', () => {
    const plans = [plan()]
    const txs = [
      tx({ id: 't1', amount: 5000, description: 'OMNICOM' }),
      tx({ id: 't2', amount: -500, description: 'OMNICOM correction', date: '2025-05-20' })
    ]
    const results = matchIncome(plans, txs, opts)
    expect(results[0]!.actual).toBe(5500)
  })
})
