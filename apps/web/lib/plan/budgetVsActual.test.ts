import { describe, it, expect } from 'vitest'
import { deriveBudgetVsActual, type BudgetRow, type TransactionRow } from './budgetVsActual'

const HID = '00000000-0000-0000-0000-000000000001'

function budget(over: Partial<BudgetRow> = {}): BudgetRow {
  return {
    id: 'b1',
    household_id: HID,
    category: 'Groceries',
    category_id: null,
    amount: 500,
    year: 2026,
    month: 5,
    sub_category: null,
    created_at: null,
    ...over
  }
}

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: HID,
    date: '2026-05-15',
    description: 'Test',
    amount: 100,
    type: 'Expense',
    category: 'Groceries',
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
    ...over
  }
}

const period = { year: 2026, month: 5 }

describe('deriveBudgetVsActual', () => {
  it('returns empty when no budgets and no transactions', () => {
    expect(deriveBudgetVsActual({ budgets: [], transactions: [], period })).toEqual([])
  })

  it('budget row with no matching transactions has actual=0', () => {
    const result = deriveBudgetVsActual({
      budgets: [budget({ category: 'Groceries', amount: 500 })],
      transactions: [],
      period
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ category: 'Groceries', budgeted: 500, actual: 0, variance: 500 })
  })

  it('sums Expense transactions in the matching category', () => {
    const result = deriveBudgetVsActual({
      budgets: [budget({ category: 'Groceries', amount: 500 })],
      transactions: [
        tx({ id: 'a', amount: 100 }),
        tx({ id: 'b', amount: 200 }),
        tx({ id: 'c', amount: 50 })
      ],
      period
    })
    expect(result[0]).toMatchObject({ category: 'Groceries', actual: 350, variance: 150 })
  })

  it('matches categories case-insensitively', () => {
    const result = deriveBudgetVsActual({
      budgets: [budget({ category: 'GROCERIES', amount: 500 })],
      transactions: [tx({ category: 'groceries', amount: 100 })],
      period
    })
    expect(result[0]!.actual).toBe(100)
  })

  it('uses absolute values (handles negative amounts)', () => {
    const result = deriveBudgetVsActual({
      budgets: [budget({ amount: 500 })],
      transactions: [tx({ amount: -250 })],
      period
    })
    expect(result[0]!.actual).toBe(250)
  })

  it('excludes Income/Refund/Transfer from the actual', () => {
    const result = deriveBudgetVsActual({
      budgets: [budget({ amount: 500 })],
      transactions: [
        tx({ id: 'a', amount: 100, type: 'Expense' }),
        tx({ id: 'b', amount: 999, type: 'Income' }),
        tx({ id: 'c', amount: 999, type: 'Refund' }),
        tx({ id: 'd', amount: 999, type: 'Transfer' })
      ],
      period
    })
    expect(result[0]!.actual).toBe(100)
  })

  it('excludes transactions outside the period', () => {
    const result = deriveBudgetVsActual({
      budgets: [budget({ amount: 500 })],
      transactions: [
        tx({ id: 'in', date: '2026-05-15', amount: 100 }),
        tx({ id: 'before', date: '2026-04-30', amount: 999 }),
        tx({ id: 'after', date: '2026-06-01', amount: 999 })
      ],
      period
    })
    expect(result[0]!.actual).toBe(100)
  })

  it('only includes budgets for the matching period', () => {
    const result = deriveBudgetVsActual({
      budgets: [
        budget({ id: 'b1', month: 5, amount: 500 }),
        budget({ id: 'b2', month: 4, amount: 999 }),
        budget({ id: 'b3', year: 2025, month: 5, amount: 999 })
      ],
      transactions: [],
      period
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.budgetId).toBe('b1')
  })

  it('includes categories with actuals but no budget (budgetId=null, budgeted=0)', () => {
    const result = deriveBudgetVsActual({
      budgets: [],
      transactions: [tx({ category: 'Surprise Spend', amount: 75 })],
      period
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      budgetId: null, category: 'Surprise Spend', budgeted: 0, actual: 75, variance: -75
    })
  })

  it('sorts over-budget first, then alphabetical', () => {
    const result = deriveBudgetVsActual({
      budgets: [
        budget({ id: 'b1', category: 'Apples', amount: 100 }),
        budget({ id: 'b2', category: 'Bananas', amount: 100 })
      ],
      transactions: [
        tx({ id: 'tA', category: 'Apples', amount: 50 }),
        tx({ id: 'tB1', category: 'Bananas', amount: 50 }),
        tx({ id: 'tB2', category: 'Bananas', amount: 60 }),
        tx({ id: 'tC', category: 'Cilantro', amount: 30 })
      ],
      period
    })
    // Bananas: over by 10 (variance=-10). Cilantro: over by 30 (variance=-30). Apples: under by 50.
    // Most-over first: Cilantro (-30), Bananas (-10), Apples (+50).
    expect(result.map(r => r.category)).toEqual(['Cilantro', 'Bananas', 'Apples'])
  })

  it('uses original-case category name when only actuals exist', () => {
    const result = deriveBudgetVsActual({
      budgets: [],
      transactions: [tx({ category: 'Coffee Subscriptions', amount: 25 })],
      period
    })
    expect(result[0]!.category).toBe('Coffee Subscriptions')
  })

  it('skips transactions with null or empty category', () => {
    const result = deriveBudgetVsActual({
      budgets: [],
      transactions: [
        tx({ id: 'a', category: null, amount: 100 }),
        tx({ id: 'b', category: '   ', amount: 100 }),
        tx({ id: 'c', category: 'Real', amount: 50 })
      ],
      period
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.category).toBe('Real')
  })

  describe('aggregation of duplicate budget rows', () => {
    it('sums multiple budget rows with the same category text into ONE output row', () => {
      const result = deriveBudgetVsActual({
        budgets: [
          budget({ id: 'b1', category: 'Housing', amount: 1500 }),
          budget({ id: 'b2', category: 'Housing', amount: 1200 }),
          budget({ id: 'b3', category: 'Housing', amount: 385 })
        ],
        transactions: [],
        period
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        category: 'Housing',
        budgeted: 3085,
        actual: 0,
        variance: 3085
      })
    })

    it('sets budgetId to null when aggregating multiple rows so per-row edit is hidden', () => {
      const result = deriveBudgetVsActual({
        budgets: [
          budget({ id: 'b1', category: 'Housing', amount: 1500 }),
          budget({ id: 'b2', category: 'Housing', amount: 1200 })
        ],
        transactions: [],
        period
      })
      expect(result[0]!.budgetId).toBeNull()
    })

    it('keeps budgetId set when only one budget row exists for the category', () => {
      const result = deriveBudgetVsActual({
        budgets: [budget({ id: 'b-solo', category: 'Solo', amount: 500 })],
        transactions: [],
        period
      })
      expect(result[0]!.budgetId).toBe('b-solo')
    })

    it('aggregates by category text even when category_id differs (legacy data)', () => {
      const result = deriveBudgetVsActual({
        budgets: [
          budget({ id: 'b1', category: 'Financial', category_id: 'cat-a', amount: 500 }),
          budget({ id: 'b2', category: 'Financial', category_id: 'cat-b', amount: 300 }),
          budget({ id: 'b3', category: 'Financial', category_id: null, amount: 500 })
        ],
        transactions: [],
        period
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ category: 'Financial', budgeted: 1300 })
      // disagreeing category_ids collapse to null
      expect(result[0]!.categoryId).toBeNull()
    })

    it('preserves category_id when all aggregated rows agree', () => {
      const result = deriveBudgetVsActual({
        budgets: [
          budget({ id: 'b1', category: 'Bills', category_id: 'cat-bills', amount: 100 }),
          budget({ id: 'b2', category: 'Bills', category_id: 'cat-bills', amount: 200 })
        ],
        transactions: [],
        period
      })
      expect(result[0]!.categoryId).toBe('cat-bills')
    })

    it('sums actuals once per category even when budget rows are duplicated', () => {
      const result = deriveBudgetVsActual({
        budgets: [
          budget({ id: 'b1', category: 'Food', amount: 200 }),
          budget({ id: 'b2', category: 'Food', amount: 100 })
        ],
        transactions: [
          tx({ id: 't1', category: 'Food', amount: 50 }),
          tx({ id: 't2', category: 'Food', amount: 75 })
        ],
        period
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ budgeted: 300, actual: 125, variance: 175 })
    })

    it('sort still correct after aggregation', () => {
      const result = deriveBudgetVsActual({
        budgets: [
          budget({ id: 'a1', category: 'Apples', amount: 50 }),
          budget({ id: 'a2', category: 'Apples', amount: 50 }), // sum=100
          budget({ id: 'b1', category: 'Bananas', amount: 100 }),
          budget({ id: 'c1', category: 'Cilantro', amount: 100 })
        ],
        transactions: [
          tx({ id: 'tA', category: 'Apples', amount: 50 }),    // variance +50
          tx({ id: 'tB1', category: 'Bananas', amount: 110 }), // variance -10
          tx({ id: 'tC', category: 'Cilantro', amount: 130 })  // variance -30
        ],
        period
      })
      expect(result.map(r => r.category)).toEqual(['Cilantro', 'Bananas', 'Apples'])
    })
  })
})
