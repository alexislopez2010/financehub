import { describe, it, expect } from 'vitest'
import { deriveBudgetSnapshot } from './budgetSnapshot'
import type { DeriveBudgetSnapshotInput } from './budgetSnapshot'

function mkBudget(
  amount: number,
  year: number,
  month: number
): DeriveBudgetSnapshotInput['budgets'][number] {
  return { amount, year, month }
}

function mkTx(
  amount: number,
  type: string,
  date: string
): DeriveBudgetSnapshotInput['transactions'][number] {
  return { amount, type, date }
}

const TODAY = { year: 2025, month: 5 }

describe('deriveBudgetSnapshot', () => {
  it('returns zero totals with null utilization and under status when there are no budgets', () => {
    const result = deriveBudgetSnapshot({ budgets: [], transactions: [], today: TODAY })
    expect(result).toEqual({
      totalBudgeted: 0,
      totalSpent: 0,
      utilization: null,
      remaining: 0,
      status: 'under'
    })
  })

  it('returns under status when spent < 90% of budgeted (happy under-budget path)', () => {
    const budgets = [mkBudget(1000, 2025, 5), mkBudget(500, 2025, 5)]
    const transactions = [
      mkTx(300, 'Expense', '2025-05-01'),
      mkTx(200, 'Expense', '2025-05-10'),
    ]
    const result = deriveBudgetSnapshot({ budgets, transactions, today: TODAY })
    expect(result.totalBudgeted).toBe(1500)
    expect(result.totalSpent).toBe(500)
    expect(result.utilization).toBeCloseTo(0.3333, 4)
    expect(result.remaining).toBe(1000)
    expect(result.status).toBe('under')
  })

  it('returns at status when utilization is exactly 1.0', () => {
    const budgets = [mkBudget(1000, 2025, 5)]
    const transactions = [mkTx(1000, 'Expense', '2025-05-15')]
    const result = deriveBudgetSnapshot({ budgets, transactions, today: TODAY })
    expect(result.utilization).toBe(1)
    expect(result.status).toBe('at')
    expect(result.remaining).toBe(0)
  })

  it('returns at status when utilization is between 0.9 and 1.0', () => {
    const budgets = [mkBudget(1000, 2025, 5)]
    const transactions = [mkTx(950, 'Expense', '2025-05-01')]
    const result = deriveBudgetSnapshot({ budgets, transactions, today: TODAY })
    expect(result.utilization).toBe(0.95)
    expect(result.status).toBe('at')
  })

  it('returns over status with negative remaining when utilization > 1.0', () => {
    const budgets = [mkBudget(1000, 2025, 5)]
    const transactions = [mkTx(1500, 'Expense', '2025-05-15')]
    const result = deriveBudgetSnapshot({ budgets, transactions, today: TODAY })
    expect(result.utilization).toBe(1.5)
    expect(result.remaining).toBe(-500)
    expect(result.status).toBe('over')
  })

  it('returns under status with utilization=0 when budgets exist but no spend', () => {
    const budgets = [mkBudget(1000, 2025, 5)]
    const result = deriveBudgetSnapshot({ budgets, transactions: [], today: TODAY })
    expect(result.totalSpent).toBe(0)
    expect(result.utilization).toBe(0)
    expect(result.remaining).toBe(1000)
    expect(result.status).toBe('under')
  })

  it('ignores budgets and transactions from other months', () => {
    const budgets = [
      mkBudget(1000, 2025, 4), // wrong month — ignored
      mkBudget(2000, 2025, 6), // wrong month — ignored
      mkBudget(500, 2024, 5), // wrong year — ignored
    ]
    const transactions = [
      mkTx(500, 'Expense', '2025-04-15'), // wrong month — ignored
      mkTx(300, 'Expense', '2025-05-10'), // current — counted
    ]
    const result = deriveBudgetSnapshot({ budgets, transactions, today: TODAY })
    expect(result.totalBudgeted).toBe(0)
    expect(result.totalSpent).toBe(300)
    // No budgeted amount → null utilization → under
    expect(result.utilization).toBeNull()
    expect(result.status).toBe('under')
  })

  it('only counts Expense transactions in totalSpent', () => {
    const budgets = [mkBudget(1000, 2025, 5)]
    const transactions = [
      mkTx(500, 'Income', '2025-05-01'), // skip
      mkTx(200, 'Refund', '2025-05-02'), // skip
      mkTx(100, 'Transfer', '2025-05-03'), // skip
      mkTx(400, 'Expense', '2025-05-04'), // counted
    ]
    const result = deriveBudgetSnapshot({ budgets, transactions, today: TODAY })
    expect(result.totalSpent).toBe(400)
  })
})
