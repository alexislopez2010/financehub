import { describe, it, expect } from 'vitest'
import { deriveSpendByCategory } from './spendByCategory'
import type { DeriveSpendByCategoryInput } from './spendByCategory'

function mkTx(
  amount: number,
  type: string,
  date: string,
  category: string | null
): DeriveSpendByCategoryInput['transactions'][number] {
  return { amount, type, date, category }
}

const TODAY = { year: 2025, month: 5 }

describe('deriveSpendByCategory', () => {
  it('returns [] for empty transactions', () => {
    const result = deriveSpendByCategory({ transactions: [], today: TODAY })
    expect(result).toEqual([])
  })

  it('returns [] when no Expense transactions exist in the current month', () => {
    const transactions = [
      mkTx(100, 'Income', '2025-05-01', 'Salary'),
      mkTx(50, 'Expense', '2025-04-01', 'Groceries'), // wrong month
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result).toEqual([])
  })

  it('returns a single row with share=1.0 and MoM=null when only one category and no prior data', () => {
    const transactions = [
      mkTx(120, 'Expense', '2025-05-01', 'Groceries'),
      mkTx(80, 'Expense', '2025-05-10', 'Groceries'),
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      category: 'Groceries',
      amount: 200,
      priorAmount: 0,
      monthOverMonth: null,
      shareOfTotal: 1
    })
  })

  it('groups extra categories beyond top N into an "Other" row at the end', () => {
    const transactions = [
      mkTx(500, 'Expense', '2025-05-01', 'Rent'),
      mkTx(300, 'Expense', '2025-05-02', 'Groceries'),
      mkTx(200, 'Expense', '2025-05-03', 'Transport'),
      mkTx(100, 'Expense', '2025-05-04', 'Subscriptions'),
      mkTx(50, 'Expense', '2025-05-05', 'Misc'),
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY, top: 3 })
    expect(result).toHaveLength(4)
    expect(result.map(r => r.category)).toEqual(['Rent', 'Groceries', 'Transport', 'Other'])
    expect(result[3]!.category).toBe('Other')
    expect(result[3]!.amount).toBe(150) // 100 + 50
  })

  it('does not add an "Other" row when there are exactly top distinct categories', () => {
    const transactions = Array.from({ length: 7 }, (_, i) =>
      mkTx(100 + i, 'Expense', '2025-05-01', `Cat${i}`)
    )
    const result = deriveSpendByCategory({ transactions, today: TODAY, top: 7 })
    expect(result).toHaveLength(7)
    expect(result.some(r => r.category === 'Other')).toBe(false)
  })

  it('computes positive monthOverMonth when current > prior for the same category', () => {
    const transactions = [
      mkTx(100, 'Expense', '2025-04-15', 'Groceries'), // prior
      mkTx(200, 'Expense', '2025-05-10', 'Groceries'), // current
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result[0]!.monthOverMonth).toBe(1) // (200-100)/100
  })

  it('computes negative monthOverMonth when current < prior for the same category', () => {
    const transactions = [
      mkTx(200, 'Expense', '2025-04-15', 'Groceries'),
      mkTx(150, 'Expense', '2025-05-10', 'Groceries'),
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result[0]!.monthOverMonth).toBe(-0.25) // (150-200)/200
  })

  it('returns null monthOverMonth when priorAmount is 0', () => {
    const transactions = [mkTx(100, 'Expense', '2025-05-01', 'NewCategory')]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result[0]!.monthOverMonth).toBeNull()
  })

  it('null or empty category names bucket into "Uncategorized"', () => {
    const transactions = [
      mkTx(50, 'Expense', '2025-05-01', null),
      mkTx(30, 'Expense', '2025-05-02', ''),
      mkTx(20, 'Expense', '2025-05-03', '   '), // whitespace-only
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]!.category).toBe('Uncategorized')
    expect(result[0]!.amount).toBe(100)
  })

  it('handles year rollover when current month is January (prior = December prev year)', () => {
    const transactions = [
      mkTx(80, 'Expense', '2025-12-15', 'Gifts'), // prior month
      mkTx(40, 'Expense', '2026-01-05', 'Gifts'), // current
    ]
    const result = deriveSpendByCategory({
      transactions,
      today: { year: 2026, month: 1 }
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.priorAmount).toBe(80)
    expect(result[0]!.monthOverMonth).toBe(-0.5)
  })

  it('ignores non-Expense transactions entirely', () => {
    const transactions = [
      mkTx(500, 'Income', '2025-05-01', 'Salary'),
      mkTx(100, 'Refund', '2025-05-02', 'Groceries'),
      mkTx(200, 'Transfer', '2025-05-03', 'Internal'),
      mkTx(50, 'Expense', '2025-05-04', 'Groceries'),
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]!.amount).toBe(50)
  })

  it('shareOfTotal across returned rows sums to ~1.0 even with an Other row', () => {
    const transactions = [
      mkTx(400, 'Expense', '2025-05-01', 'A'),
      mkTx(300, 'Expense', '2025-05-02', 'B'),
      mkTx(200, 'Expense', '2025-05-03', 'C'),
      mkTx(100, 'Expense', '2025-05-04', 'D'),
    ]
    const result = deriveSpendByCategory({ transactions, today: TODAY, top: 2 })
    const sum = result.reduce((acc, r) => acc + r.shareOfTotal, 0)
    expect(sum).toBeCloseTo(1, 3)
  })
})
