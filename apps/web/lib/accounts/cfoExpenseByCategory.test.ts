import { describe, expect, it } from 'vitest'
import { deriveCfoExpenseByCategory } from './cfoExpenseByCategory'

interface MkTxOverrides {
  id?: string
  date?: string
  amount?: number
  type?: string
  category?: string | null
}

/** Minimal fixture matching the Pick<> the module accepts. */
function mkTx(over: MkTxOverrides = {}) {
  return {
    id: over.id ?? 't1',
    date: over.date ?? '2026-01-15',
    amount: over.amount ?? 100,
    type: over.type ?? 'Expense',
    category: over.category === undefined ? null : over.category
  }
}

describe('deriveCfoExpenseByCategory', () => {
  it('returns empty when no expense transactions fall in the YTD window', () => {
    // Arrange — only a 2025 transaction; year = 2026.
    const rows = deriveCfoExpenseByCategory({
      transactions: [mkTx({ date: '2025-12-15' })],
      year: 2026,
      monthsElapsed: 5
    })

    // Assert
    expect(rows).toEqual([])
  })

  it('groups by category and sorts by totalYtd desc', () => {
    // Arrange
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', amount: 50,  category: 'Food'    }),
        mkTx({ id: 'b', amount: 200, category: 'Housing' }),
        mkTx({ id: 'c', amount: 30,  category: 'Food'    })
      ],
      year: 2026,
      monthsElapsed: 5
    })

    // Assert
    expect(rows.map(r => r.category)).toEqual(['Housing', 'Food'])
    expect(rows[0]).toMatchObject({ category: 'Housing', totalYtd: 200, avgMonthly: 40, count: 1 })
    expect(rows[1]).toMatchObject({ category: 'Food',    totalYtd: 80,  avgMonthly: 16, count: 2 })
  })

  it('computes avgMonthly as totalYtd / monthsElapsed', () => {
    // Arrange — $1,200 spend across 6 elapsed months = $200/mo avg.
    const rows = deriveCfoExpenseByCategory({
      transactions: [mkTx({ amount: 1200, category: 'Housing' })],
      year: 2026,
      monthsElapsed: 6
    })

    // Assert
    expect(rows[0]?.avgMonthly).toBe(200)
  })

  it('treats null and whitespace-only category as Uncategorized', () => {
    // Arrange
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', amount: 10, category: null  }),
        mkTx({ id: 'b', amount: 20, category: '   ' })
      ],
      year: 2026,
      monthsElapsed: 1
    })

    // Assert
    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe('Uncategorized')
    expect(rows[0]?.totalYtd).toBe(30)
    expect(rows[0]?.count).toBe(2)
  })

  it('excludes Income, Refund, and Transfer rows', () => {
    // Arrange
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', amount: 1000, category: 'Salary', type: 'Income'   }),
        mkTx({ id: 'b', amount: 25,   category: 'Refund', type: 'Refund'   }),
        mkTx({ id: 'c', amount: 50,   category: 'Move',   type: 'Transfer' }),
        mkTx({ id: 'd', amount: 30,   category: 'Food',   type: 'Expense'  })
      ],
      year: 2026,
      monthsElapsed: 1
    })

    // Assert
    expect(rows).toHaveLength(1)
    expect(rows[0]?.category).toBe('Food')
  })

  it('excludes transactions outside the YTD window', () => {
    // Arrange — wrong year + after monthsElapsed=5 should drop.
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', date: '2025-12-15', amount: 100, category: 'Old'    }),
        mkTx({ id: 'b', date: '2026-06-15', amount: 100, category: 'Future' }),
        mkTx({ id: 'c', date: '2026-03-15', amount: 100, category: 'Now'    })
      ],
      year: 2026,
      monthsElapsed: 5
    })

    // Assert
    expect(rows.map(r => r.category)).toEqual(['Now'])
  })

  it('includes the boundary month (month === monthsElapsed)', () => {
    // Arrange — May 31 with monthsElapsed = 5 should be included.
    const rows = deriveCfoExpenseByCategory({
      transactions: [mkTx({ date: '2026-05-31', amount: 99, category: 'Food' })],
      year: 2026,
      monthsElapsed: 5
    })

    // Assert
    expect(rows).toHaveLength(1)
    expect(rows[0]?.totalYtd).toBe(99)
  })

  it('computes shareOfTotal that sums to 1.0', () => {
    // Arrange
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', amount: 600, category: 'Housing' }),
        mkTx({ id: 'b', amount: 300, category: 'Food'    }),
        mkTx({ id: 'c', amount: 100, category: 'Other'   })
      ],
      year: 2026,
      monthsElapsed: 1
    })

    // Assert
    const sum = rows.reduce((acc, r) => acc + r.shareOfTotal, 0)
    expect(sum).toBeCloseTo(1, 5)
    expect(rows[0]?.shareOfTotal).toBe(0.6)
  })

  it('returns transactionIds in input order per category', () => {
    // Arrange
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 't1', amount: 10, category: 'Food' }),
        mkTx({ id: 't2', amount: 20, category: 'Food' }),
        mkTx({ id: 't3', amount: 30, category: 'Food' })
      ],
      year: 2026,
      monthsElapsed: 1
    })

    // Assert
    expect(rows[0]?.transactionIds).toEqual(['t1', 't2', 't3'])
  })

  it('uses absolute value of amount (negative-stored expenses still aggregate positively)', () => {
    // Arrange — Expense rows can land in DB with signed amount; the function
    // should sum |amount| so the spend total is always positive.
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', amount: -50, category: 'Food' }),
        mkTx({ id: 'b', amount:  30, category: 'Food' })
      ],
      year: 2026,
      monthsElapsed: 1
    })

    // Assert
    expect(rows[0]?.totalYtd).toBe(80)
  })

  it('rejects rows with unparseable dates without throwing', () => {
    // Arrange — bad date strings shouldn't crash; they just don't match the prefix.
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', date: 'not-a-date', amount: 50, category: 'Food' }),
        mkTx({ id: 'b', date: '2026-02-10', amount: 25, category: 'Food' })
      ],
      year: 2026,
      monthsElapsed: 5
    })

    // Assert
    expect(rows).toHaveLength(1)
    expect(rows[0]?.totalYtd).toBe(25)
  })

  it('returns empty when monthsElapsed = 0', () => {
    // Arrange — no month satisfies month >= 1 && month <= 0.
    const rows = deriveCfoExpenseByCategory({
      transactions: [mkTx({ amount: 100, category: 'Food' })],
      year: 2026,
      monthsElapsed: 0
    })

    // Assert
    expect(rows).toEqual([])
  })

  it('sorts ties alphabetically for stable output', () => {
    // Arrange — equal totals; sort should fall back to category name asc.
    const rows = deriveCfoExpenseByCategory({
      transactions: [
        mkTx({ id: 'a', amount: 100, category: 'Zeta'  }),
        mkTx({ id: 'b', amount: 100, category: 'Alpha' })
      ],
      year: 2026,
      monthsElapsed: 1
    })

    // Assert
    expect(rows.map(r => r.category)).toEqual(['Alpha', 'Zeta'])
  })
})
