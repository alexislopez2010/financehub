import { describe, it, expect } from 'vitest'
import { transactionsForBudgetRow } from './budgetRowTransactions'
import type { TransactionRow } from '@/lib/finance/types'

let counter = 0
function tx(over: Partial<TransactionRow>): TransactionRow {
  counter += 1
  return {
    id: over.id ?? `tx-${counter}`,
    household_id: 'h',
    date: over.date ?? '2026-06-15',
    description: over.description ?? '',
    amount: over.amount ?? -10,
    type: over.type ?? 'Expense',
    category: over.category ?? null,
    category_id: over.category_id ?? null,
    account: over.account ?? null,
    member: over.member ?? null,
    transfer_pair_id: over.transfer_pair_id ?? null
  }
}

describe('transactionsForBudgetRow', () => {
  const period = { year: 2026, month: 6 }

  it('returns empty when category is empty / whitespace', () => {
    const all = [tx({ date: '2026-06-01', category: 'Housing' })]
    expect(transactionsForBudgetRow({ transactions: all, period, category: '' })).toEqual([])
    expect(transactionsForBudgetRow({ transactions: all, period, category: '   ' })).toEqual([])
  })

  it('matches Expense transactions in the period whose category matches case-insensitively', () => {
    const all = [
      tx({ id: '1', date: '2026-06-01', category: 'Housing',  amount: -2500 }),
      tx({ id: '2', date: '2026-06-15', category: 'housing',  amount: -85 }),
      tx({ id: '3', date: '2026-06-02', category: 'HOUSING',  amount: -1500 }),
      tx({ id: '4', date: '2026-06-03', category: 'Groceries', amount: -50 }),
      tx({ id: '5', date: '2026-05-31', category: 'Housing',  amount: -100 }) // wrong month
    ]
    const result = transactionsForBudgetRow({ transactions: all, period, category: 'Housing' })
    expect(result.map(t => t.id)).toEqual(['1', '3', '2'])
  })

  it('ignores non-Expense transactions even when the category matches', () => {
    const all = [
      tx({ id: '1', date: '2026-06-01', category: 'Refunds', type: 'Refund', amount: 50 }),
      tx({ id: '2', date: '2026-06-02', category: 'Refunds', type: 'Income', amount: 100 }),
      tx({ id: '3', date: '2026-06-03', category: 'Refunds', type: 'Expense', amount: -25 })
    ]
    const result = transactionsForBudgetRow({ transactions: all, period, category: 'Refunds' })
    expect(result.map(t => t.id)).toEqual(['3'])
  })

  it('sorts by absolute amount desc with date desc as tiebreaker', () => {
    const all = [
      tx({ id: 'small',     date: '2026-06-01', category: 'X', amount: -10 }),
      tx({ id: 'big-early', date: '2026-06-01', category: 'X', amount: -500 }),
      tx({ id: 'big-late',  date: '2026-06-20', category: 'X', amount: -500 }),
      tx({ id: 'mid',       date: '2026-06-10', category: 'X', amount: -100 })
    ]
    const result = transactionsForBudgetRow({ transactions: all, period, category: 'X' })
    expect(result.map(t => t.id)).toEqual(['big-late', 'big-early', 'mid', 'small'])
  })

  it('handles missing category fields gracefully', () => {
    const all = [
      tx({ id: '1', date: '2026-06-01', category: null, amount: -100 }),
      tx({ id: '2', date: '2026-06-02', category: 'Housing', amount: -200 })
    ]
    const result = transactionsForBudgetRow({ transactions: all, period, category: 'Housing' })
    expect(result.map(t => t.id)).toEqual(['2'])
  })

  it('filters by period boundary correctly across year wrap', () => {
    const all = [
      tx({ id: 'dec', date: '2025-12-31', category: 'X', amount: -50 }),
      tx({ id: 'jan-1', date: '2026-01-01', category: 'X', amount: -100 }),
      tx({ id: 'jan-30', date: '2026-01-30', category: 'X', amount: -200 }),
      tx({ id: 'feb', date: '2026-02-01', category: 'X', amount: -300 })
    ]
    const jan = transactionsForBudgetRow({ transactions: all, period: { year: 2026, month: 1 }, category: 'X' })
    expect(jan.map(t => t.id)).toEqual(['jan-30', 'jan-1'])
  })
})
