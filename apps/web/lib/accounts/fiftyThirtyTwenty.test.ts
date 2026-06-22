import { describe, expect, it } from 'vitest'
import { deriveFiftyThirtyTwenty, type TransactionRow, type CategoryRow } from './fiftyThirtyTwenty'

const HID = 'h'

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1', household_id: HID, date: '2026-03-15', description: 'x',
    amount: 100, type: 'Expense',
    category: null, category_id: null, account: null, account_id: null,
    created_at: null, fingerprint: null, imported_at: null, member: null,
    notes: null, payment_method: null, sub_category: null,
    transfer_group_id: null, transfer_pair_id: null, exclude_from_runway: false,
    ...over
  } as TransactionRow
}

function cat(over: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'c1', household_id: HID, name: 'Housing', type: 'expense',
    is_fixed: true, parent_category: null, tier: null, created_at: null,
    ...over
  }
}

describe('deriveFiftyThirtyTwenty', () => {
  it('computes targets at 50/30/20 of monthlyIncome', () => {
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 10000,
      transactions: [], categories: [],
      year: 2026, monthsElapsed: 6
    })
    expect(r.needs.target).toBe(5000)
    expect(r.wants.target).toBe(3000)
    expect(r.savings.target).toBe(2000)
  })

  it('buckets Expense rows by their category.is_fixed flag via category_id FK', () => {
    const housing = cat({ id: 'c-housing', name: 'Housing', is_fixed: true })
    const dining  = cat({ id: 'c-dining',  name: 'Dining',  is_fixed: false })
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 10000,
      transactions: [
        tx({ id: 't1', category_id: 'c-housing', amount: 2400 }),  // $400/mo
        tx({ id: 't2', category_id: 'c-dining',  amount: 1800 })   // $300/mo
      ],
      categories: [housing, dining],
      year: 2026, monthsElapsed: 6
    })
    expect(r.needs.actual).toBe(400)
    expect(r.wants.actual).toBe(300)
    expect(r.savings.actual).toBe(10000 - 400 - 300)
  })

  it('falls back to category text name when category_id is missing', () => {
    const housing = cat({ id: 'c-housing', name: 'Housing', is_fixed: true })
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 10000,
      transactions: [
        // Older import — no category_id but text matches
        tx({ id: 't1', category_id: null, category: 'Housing', amount: 600 })
      ],
      categories: [housing],
      year: 2026, monthsElapsed: 6
    })
    expect(r.needs.actual).toBe(100)
  })

  it('puts transactions with no matchable category into unclassifiedYtdExpense', () => {
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 10000,
      transactions: [tx({ id: 't1', amount: 1200, category_id: null, category: null })],
      categories: [],
      year: 2026, monthsElapsed: 6
    })
    expect(r.unclassifiedYtdExpense).toBe(1200)
    expect(r.needs.actual).toBe(0)
    expect(r.wants.actual).toBe(0)
  })

  it('variance is target − actual (positive = under, negative = over)', () => {
    const wantsCat = cat({ id: 'c-wants', name: 'Fun', is_fixed: false })
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 10000,
      transactions: [tx({ category_id: 'c-wants', amount: 24000 })],  // $4000/mo wants
      categories: [wantsCat],
      year: 2026, monthsElapsed: 6
    })
    expect(r.wants.target).toBe(3000)
    expect(r.wants.actual).toBe(4000)
    expect(r.wants.variance).toBe(-1000)  // over budget by $1k
  })

  it('savings can go negative when spending exceeds income', () => {
    const housing = cat({ id: 'c-housing', name: 'Housing', is_fixed: true })
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 1000,
      transactions: [tx({ category_id: 'c-housing', amount: 9000 })],  // $1500/mo needs
      categories: [housing],
      year: 2026, monthsElapsed: 6
    })
    expect(r.savings.actual).toBe(-500)
    expect(r.savings.variance).toBe(700)  // 200 target − (−500) actual
  })

  it('actualPct is 0 when income is 0 (no divide-by-zero)', () => {
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 0,
      transactions: [], categories: [],
      year: 2026, monthsElapsed: 6
    })
    expect(r.needs.actualPct).toBe(0)
    expect(r.wants.actualPct).toBe(0)
    expect(r.savings.actualPct).toBe(0)
  })

  it('excludes wrong-year and non-Expense transactions', () => {
    const cat1 = cat({ id: 'c1', is_fixed: true })
    const r = deriveFiftyThirtyTwenty({
      monthlyIncome: 10000,
      transactions: [
        tx({ date: '2025-12-15', category_id: 'c1', amount: 500 }),       // wrong year
        tx({ date: '2026-03-15', category_id: 'c1', amount: 600, type: 'Income' }),    // wrong type
        tx({ date: '2026-03-15', category_id: 'c1', amount: 600, type: 'Transfer' }),  // wrong type
        tx({ date: '2026-03-15', category_id: 'c1', amount: 1200 })       // counts
      ],
      categories: [cat1],
      year: 2026, monthsElapsed: 6
    })
    expect(r.needs.actual).toBe(200)
  })
})
