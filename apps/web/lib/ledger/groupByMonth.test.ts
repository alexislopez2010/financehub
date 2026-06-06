import { describe, it, expect } from 'vitest'
import { groupByMonth, type TransactionRow } from './groupByMonth'
import type { Tables } from '@/lib/supabase/database.types'

function tx(over: Partial<Tables<'transactions'>> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: 'h',
    date: '2025-05-15',
    description: 't',
    amount: 100,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    account_id: null,
    created_at: null,
    fingerprint: null,
    imported_at: null,
    member: null,
    notes: null,
    payment_method: null,
    sub_category: null,
    transfer_group_id: null,
    transfer_pair_id: null,

    exclude_from_runway: false,    ...over
  }
}

describe('groupByMonth', () => {
  it('returns empty for empty input', () => {
    expect(groupByMonth([])).toEqual([])
  })

  it('groups transactions by year-month', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-15' }),
      tx({ id: 'b', date: '2025-05-01' }),
      tx({ id: 'c', date: '2025-04-30' })
    ])
    expect(out).toHaveLength(2)
    expect(out[0]!.ym).toBe('2025-05')
    expect(out[0]!.items).toHaveLength(2)
    expect(out[1]!.ym).toBe('2025-04')
    expect(out[1]!.items).toHaveLength(1)
  })

  it('sorts months newest-first', () => {
    const out = groupByMonth([
      tx({ id: 'old', date: '2024-12-15' }),
      tx({ id: 'new', date: '2025-05-15' }),
      tx({ id: 'mid', date: '2025-01-15' })
    ])
    expect(out.map(g => g.ym)).toEqual(['2025-05', '2025-01', '2024-12'])
  })

  it('produces human-readable labels', () => {
    const out = groupByMonth([tx({ date: '2025-05-15' })])
    expect(out[0]!.label).toBe('May 2025')
  })

  it('sums totalExpense across the month', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-15', amount: 100, type: 'Expense' }),
      tx({ id: 'b', date: '2025-05-20', amount: 200, type: 'Expense' }),
      tx({ id: 'c', date: '2025-05-25', amount: 50, type: 'Income' })
    ])
    expect(out[0]!.totalExpense).toBe(300)
    expect(out[0]!.totalIncome).toBe(50)
  })

  it('uses absolute values for sums (negative amounts handled)', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-15', amount: -100, type: 'Expense' }),
      tx({ id: 'b', date: '2025-05-20', amount: 50, type: 'Refund' })
    ])
    expect(out[0]!.totalExpense).toBe(100)
    expect(out[0]!.totalIncome).toBe(50)
  })

  it('Transfer transactions are excluded from income/expense totals', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-15', amount: 100, type: 'Expense' }),
      tx({ id: 'b', date: '2025-05-20', amount: 500, type: 'Transfer' })
    ])
    expect(out[0]!.totalExpense).toBe(100)
    expect(out[0]!.totalIncome).toBe(0)
  })

  it('computes totalTransfers separately from income/expense in a mixed month', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-15', amount: 100, type: 'Expense' }),
      tx({ id: 'b', date: '2025-05-18', amount: 250, type: 'Income' }),
      tx({ id: 'c', date: '2025-05-20', amount: 500, type: 'Transfer' }),
      tx({ id: 'd', date: '2025-05-22', amount: -500, type: 'Transfer' })
    ])
    expect(out[0]!.totalExpense).toBe(100)
    expect(out[0]!.totalIncome).toBe(250)
    expect(out[0]!.totalTransfers).toBe(1000)
  })

  it('a month with only Transfer rows reports zero income/expense and summed transfers', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-10', amount: 400, type: 'Transfer' }),
      tx({ id: 'b', date: '2025-05-12', amount: 250, type: 'Transfer' })
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.totalIncome).toBe(0)
    expect(out[0]!.totalExpense).toBe(0)
    expect(out[0]!.totalTransfers).toBe(650)
  })

  it('totalTransfers is 0 when no Transfer rows are present', () => {
    const out = groupByMonth([
      tx({ id: 'a', date: '2025-05-15', amount: 100, type: 'Expense' }),
      tx({ id: 'b', date: '2025-05-18', amount: 200, type: 'Income' })
    ])
    expect(out[0]!.totalTransfers).toBe(0)
  })

  it('skips transactions with invalid date strings', () => {
    const out = groupByMonth([
      tx({ id: 'good', date: '2025-05-15' }),
      tx({ id: 'bad', date: 'not-a-date' })
    ])
    expect(out).toHaveLength(1)
    expect(out[0]!.items).toHaveLength(1)
  })

  it('preserves the input order within a month', () => {
    const out = groupByMonth([
      tx({ id: 'c', date: '2025-05-15' }),
      tx({ id: 'b', date: '2025-05-15' }),
      tx({ id: 'a', date: '2025-05-15' })
    ])
    expect(out[0]!.items.map(i => i.id)).toEqual(['c', 'b', 'a'])
  })
})
