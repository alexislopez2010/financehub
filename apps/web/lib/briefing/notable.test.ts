import { describe, it, expect } from 'vitest'
import {
  notableCallouts,
  findDuplicateCharges,
  findCategorySwings,
  findSlippedBills,
} from './notable'
import type { TransactionRow, BillRow } from './notable'

// Minimal transaction fixture satisfying Tables<'transactions'> Row shape.
let txIdSeq = 0
function mkTx(overrides: {
  amount: number
  type: string
  date: string
  description?: string
  category?: string | null
  account_id?: string | null
}): TransactionRow {
  txIdSeq += 1
  return {
    id: `tx-${txIdSeq}`,
    household_id: 'hh1',
    amount: overrides.amount,
    type: overrides.type,
    date: overrides.date,
    description: overrides.description ?? 'Test',
    category: overrides.category ?? null,
    category_id: null,
    account: null,
    account_id: overrides.account_id ?? null,
    member: null,
    notes: null,
    payment_method: null,
    sub_category: null,
    transfer_group_id: null,
    transfer_pair_id: null,
    fingerprint: null,
    imported_at: null,
    created_at: null,
  }
}

// Minimal bill fixture satisfying Tables<'bills'> Row shape.
function mkBill(overrides: {
  id: string
  name: string
  budget_amount: number
  due_day: number | null
  is_active?: boolean | null
}): BillRow {
  return {
    id: overrides.id,
    name: overrides.name,
    budget_amount: overrides.budget_amount,
    budget_category_id: null,
    due_day: overrides.due_day,
    due_month_anchor: null,
    is_active: overrides.is_active ?? true,
    household_id: 'hh1',
    account: null,
    category: null,
    created_at: null,
    frequency: null,
    linked_debt_id: null,
    notes: null,
  }
}

// ─── findDuplicateCharges ─────────────────────────────────────────────────────

describe('findDuplicateCharges', () => {
  const TODAY = { year: 2025, month: 5, day: 20 }

  it('returns empty when no transactions', () => {
    const result = findDuplicateCharges([], TODAY)
    expect(result).toEqual([])
  })

  it('returns empty when only one transaction per merchant', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toEqual([])
  })

  it('flags two Expense transactions with same description and amount within 7 days', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-05', description: 'Netflix' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('duplicate_charge')
    expect(result[0]!.impact).toBe(9.99)
    expect(result[0]!.lead).toBe('Duplicate charge.')
  })

  it('does not flag when dates are more than 7 days apart', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-10', description: 'Netflix' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toEqual([])
  })

  it('does not flag when amounts differ', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
      mkTx({ amount: 15.99, type: 'Expense', date: '2025-05-03', description: 'Netflix' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toEqual([])
  })

  it('does not flag Income transactions as duplicates', () => {
    const txs = [
      mkTx({ amount: 1000, type: 'Income', date: '2025-05-01', description: 'Payroll' }),
      mkTx({ amount: 1000, type: 'Income', date: '2025-05-03', description: 'Payroll' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toEqual([])
  })

  it('does not flag Refund type as duplicates', () => {
    const txs = [
      mkTx({ amount: 50, type: 'Refund', date: '2025-05-01', description: 'Amazon' }),
      mkTx({ amount: 50, type: 'Refund', date: '2025-05-03', description: 'Amazon' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toEqual([])
  })

  it('is case-insensitive for description matching', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'NETFLIX' }),
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-03', description: 'netflix' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toHaveLength(1)
  })

  it('only checks current month transactions', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-04-29', description: 'Netflix' }),
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
    ]
    // April transaction is excluded; only 1 in current month
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toEqual([])
  })

  it('returns one callout per merchant even with three duplicates', () => {
    const txs = [
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-03', description: 'Netflix' }),
      mkTx({ amount: 9.99, type: 'Expense', date: '2025-05-05', description: 'Netflix' }),
    ]
    const result = findDuplicateCharges(txs, TODAY)
    expect(result).toHaveLength(1)
  })
})

// ─── findCategorySwings ───────────────────────────────────────────────────────

describe('findCategorySwings', () => {
  const TODAY = { year: 2025, month: 5, day: 20 }

  it('returns empty when no transactions', () => {
    const result = findCategorySwings([], TODAY)
    expect(result).toEqual([])
  })

  it('returns empty when no trailing months data', () => {
    // Only current month expenses — no trailing average to compare
    const txs = [
      mkTx({ amount: 100, type: 'Expense', date: '2025-05-01', category: 'Food' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toEqual([])
  })

  it('flags a category with >15% increase vs trailing 3-month average', () => {
    const txs = [
      // Trailing months: ~$100 avg
      mkTx({ amount: 100, type: 'Expense', date: '2025-02-01', category: 'Food' }),
      mkTx({ amount: 100, type: 'Expense', date: '2025-03-01', category: 'Food' }),
      mkTx({ amount: 100, type: 'Expense', date: '2025-04-01', category: 'Food' }),
      // Current month: $200 (+100%)
      mkTx({ amount: 200, type: 'Expense', date: '2025-05-01', category: 'Food' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('category_swing')
    expect(result[0]!.lead).toContain('Food')
    expect(result[0]!.lead).toContain('up')
    expect(result[0]!.impact).toBeCloseTo(100, 1)
  })

  it('flags a category with >15% decrease vs trailing 3-month average', () => {
    const txs = [
      mkTx({ amount: 200, type: 'Expense', date: '2025-02-01', category: 'Dining' }),
      mkTx({ amount: 200, type: 'Expense', date: '2025-03-01', category: 'Dining' }),
      mkTx({ amount: 200, type: 'Expense', date: '2025-04-01', category: 'Dining' }),
      // Current month: $100 (-50%)
      mkTx({ amount: 100, type: 'Expense', date: '2025-05-01', category: 'Dining' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]!.lead).toContain('down')
    expect(result[0]!.impact).toBeCloseTo(100, 1)
  })

  it('does not flag a category with <=15% change', () => {
    const txs = [
      mkTx({ amount: 100, type: 'Expense', date: '2025-02-01', category: 'Subscriptions' }),
      mkTx({ amount: 100, type: 'Expense', date: '2025-03-01', category: 'Subscriptions' }),
      mkTx({ amount: 100, type: 'Expense', date: '2025-04-01', category: 'Subscriptions' }),
      // Current month: $110 (+10%)
      mkTx({ amount: 110, type: 'Expense', date: '2025-05-01', category: 'Subscriptions' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toEqual([])
  })

  it('only includes trailing months that have data', () => {
    // Only 1 trailing month
    const txs = [
      mkTx({ amount: 100, type: 'Expense', date: '2025-04-01', category: 'Gas' }),
      mkTx({ amount: 200, type: 'Expense', date: '2025-05-01', category: 'Gas' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toHaveLength(1)  // 200 vs 100 avg = +100%
    expect(result[0]!.kind).toBe('category_swing')
  })

  it('ignores non-Expense transactions', () => {
    const txs = [
      mkTx({ amount: 100, type: 'Income', date: '2025-04-01', category: 'Salary' }),
      mkTx({ amount: 300, type: 'Income', date: '2025-05-01', category: 'Salary' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toEqual([])
  })

  it('uses "(Uncategorized)" for null category', () => {
    const txs = [
      mkTx({ amount: 100, type: 'Expense', date: '2025-04-01', category: null }),
      mkTx({ amount: 250, type: 'Expense', date: '2025-05-01', category: null }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]!.lead).toContain('(Uncategorized)')
  })

  it('impact is the absolute dollar delta from avg', () => {
    const txs = [
      mkTx({ amount: 100, type: 'Expense', date: '2025-04-01', category: 'Transport' }),
      mkTx({ amount: 200, type: 'Expense', date: '2025-05-01', category: 'Transport' }),
    ]
    const result = findCategorySwings(txs, TODAY)
    expect(result[0]!.impact).toBeCloseTo(100, 1)  // 200 - 100 = 100
  })
})

// ─── findSlippedBills ─────────────────────────────────────────────────────────

describe('findSlippedBills', () => {
  const TODAY = { year: 2025, month: 5, day: 20 }

  it('returns empty when no bills', () => {
    const result = findSlippedBills([], [], TODAY)
    expect(result).toEqual([])
  })

  it('returns empty for inactive bills', () => {
    const bills = [mkBill({ id: 'b1', name: 'Rent', budget_amount: 1200, due_day: 15, is_active: false })]
    const result = findSlippedBills([], bills, TODAY)
    expect(result).toEqual([])
  })

  it('returns empty for bills with null due_day', () => {
    const bills = [mkBill({ id: 'b1', name: 'Rent', budget_amount: 1200, due_day: null })]
    const result = findSlippedBills([], bills, TODAY)
    expect(result).toEqual([])
  })

  it('flags a bill due within the last 7 days with no matching transaction', () => {
    // TODAY = May 20, bill due_day = 15 → due May 15 (5 days ago)
    const bills = [mkBill({ id: 'b1', name: 'Internet', budget_amount: 80, due_day: 15 })]
    const result = findSlippedBills([], bills, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]!.kind).toBe('slipped_bill')
    expect(result[0]!.lead).toContain('Internet')
    expect(result[0]!.impact).toBe(80)
  })

  it('does not flag a bill that is not yet due', () => {
    // TODAY = May 20, bill due_day = 25 → due May 25 (5 days from now)
    const bills = [mkBill({ id: 'b1', name: 'Gym', budget_amount: 50, due_day: 25 })]
    const result = findSlippedBills([], bills, TODAY)
    expect(result).toEqual([])
  })

  it('does not flag a bill due more than 7 days ago', () => {
    // TODAY = May 20, bill due_day = 10 → due May 10 (10 days ago)
    const bills = [mkBill({ id: 'b1', name: 'Old Bill', budget_amount: 100, due_day: 10 })]
    const result = findSlippedBills([], bills, TODAY)
    expect(result).toEqual([])
  })

  it('does not flag when a matching transaction exists within ±3 days', () => {
    // TODAY = May 20, bill due_day = 15 → due May 15
    const bills = [mkBill({ id: 'b1', name: 'Netflix', budget_amount: 15, due_day: 15 })]
    const txs = [
      // Transaction on May 16 (1 day after due, within 3) with "netflix" in description
      mkTx({ amount: 15, type: 'Expense', date: '2025-05-16', description: 'NETFLIX SUBSCRIPTION' }),
    ]
    const result = findSlippedBills(txs, bills, TODAY)
    expect(result).toEqual([])
  })

  it('flags when matching transaction is more than 3 days away from due date', () => {
    // TODAY = May 20, bill due_day = 15 → due May 15
    const bills = [mkBill({ id: 'b1', name: 'Netflix', budget_amount: 15, due_day: 15 })]
    const txs = [
      // Transaction on May 10 (5 days before due, outside ±3)
      mkTx({ amount: 15, type: 'Expense', date: '2025-05-10', description: 'Netflix Streaming' }),
    ]
    const result = findSlippedBills(txs, bills, TODAY)
    expect(result).toHaveLength(1)
  })

  it('does not match on non-Expense transactions', () => {
    const bills = [mkBill({ id: 'b1', name: 'Netflix', budget_amount: 15, due_day: 15 })]
    const txs = [
      mkTx({ amount: 15, type: 'Refund', date: '2025-05-15', description: 'Netflix refund' }),
    ]
    const result = findSlippedBills(txs, bills, TODAY)
    expect(result).toHaveLength(1)  // Refund doesn't count as a payment
  })

  it('matching is case-insensitive on bill name', () => {
    const bills = [mkBill({ id: 'b1', name: 'NETFLIX', budget_amount: 15, due_day: 15 })]
    const txs = [
      mkTx({ amount: 15, type: 'Expense', date: '2025-05-15', description: 'netflix monthly' }),
    ]
    const result = findSlippedBills(txs, bills, TODAY)
    expect(result).toEqual([])
  })

  it('handles February clamping for due_day=31', () => {
    // In February 2025, day 31 clamps to 28
    const today = { year: 2025, month: 2, day: 28 }
    const bills = [mkBill({ id: 'b1', name: 'Rent', budget_amount: 1500, due_day: 31 })]
    const result = findSlippedBills([], bills, today)
    expect(result).toHaveLength(1)  // due today (0 days ago), no matching tx
  })
})

// ─── notableCallouts ──────────────────────────────────────────────────────────

describe('notableCallouts', () => {
  it('returns empty when no callouts detected', () => {
    const result = notableCallouts({ transactions: [], bills: [], today: { year: 2025, month: 5, day: 20 } })
    expect(result).toEqual([])
  })

  it('returns at most top=3 callouts by default', () => {
    // Manufacture 4 separate duplicate charges
    const today = { year: 2025, month: 5, day: 20 }
    const txs = [
      mkTx({ amount: 10, type: 'Expense', date: '2025-05-01', description: 'Service A' }),
      mkTx({ amount: 10, type: 'Expense', date: '2025-05-02', description: 'Service A' }),
      mkTx({ amount: 20, type: 'Expense', date: '2025-05-01', description: 'Service B' }),
      mkTx({ amount: 20, type: 'Expense', date: '2025-05-02', description: 'Service B' }),
      mkTx({ amount: 30, type: 'Expense', date: '2025-05-01', description: 'Service C' }),
      mkTx({ amount: 30, type: 'Expense', date: '2025-05-02', description: 'Service C' }),
      mkTx({ amount: 40, type: 'Expense', date: '2025-05-01', description: 'Service D' }),
      mkTx({ amount: 40, type: 'Expense', date: '2025-05-02', description: 'Service D' }),
    ]
    const result = notableCallouts({ transactions: txs, bills: [], today })
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('respects custom top value', () => {
    const today = { year: 2025, month: 5, day: 20 }
    const txs = [
      mkTx({ amount: 10, type: 'Expense', date: '2025-05-01', description: 'SvcA' }),
      mkTx({ amount: 10, type: 'Expense', date: '2025-05-02', description: 'SvcA' }),
      mkTx({ amount: 20, type: 'Expense', date: '2025-05-01', description: 'SvcB' }),
      mkTx({ amount: 20, type: 'Expense', date: '2025-05-02', description: 'SvcB' }),
    ]
    const result = notableCallouts({ transactions: txs, bills: [], today, top: 1 })
    expect(result).toHaveLength(1)
  })

  it('ranks callouts by impact descending', () => {
    const today = { year: 2025, month: 5, day: 20 }
    // Two duplicate charges: $30 and $5
    const txs = [
      mkTx({ amount: 5, type: 'Expense', date: '2025-05-01', description: 'Small Service' }),
      mkTx({ amount: 5, type: 'Expense', date: '2025-05-02', description: 'Small Service' }),
      mkTx({ amount: 30, type: 'Expense', date: '2025-05-01', description: 'Big Service' }),
      mkTx({ amount: 30, type: 'Expense', date: '2025-05-02', description: 'Big Service' }),
    ]
    const result = notableCallouts({ transactions: txs, bills: [], today, top: 2 })
    expect(result[0]!.impact).toBeGreaterThan(result[1]!.impact)
    expect(result[0]!.impact).toBe(30)
    expect(result[1]!.impact).toBe(5)
  })

  it('mixes callout types and returns top by impact', () => {
    const today = { year: 2025, month: 5, day: 20 }
    // Slipped bill worth $200 > duplicate charge worth $10
    const bills = [mkBill({ id: 'b1', name: 'Mortgage', budget_amount: 200, due_day: 15 })]
    const txs = [
      mkTx({ amount: 10, type: 'Expense', date: '2025-05-01', description: 'Netflix' }),
      mkTx({ amount: 10, type: 'Expense', date: '2025-05-02', description: 'Netflix' }),
    ]
    const result = notableCallouts({ transactions: txs, bills, today, top: 2 })
    expect(result[0]!.kind).toBe('slipped_bill')
    expect(result[0]!.impact).toBe(200)
  })
})
