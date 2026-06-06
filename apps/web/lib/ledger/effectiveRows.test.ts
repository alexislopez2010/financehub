import { describe, expect, it } from 'vitest'
import {
  expandToEffectiveRows,
  splitParentIds,
  type TransactionRow,
  type TransactionSplitRow
} from './effectiveRows'

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1', household_id: 'h1', amount: -100, type: 'Expense',
    date: '2026-05-15', description: 'Costco', account: 'AmEx', account_id: 'a1',
    category: 'Groceries', category_id: 'c-groc', sub_category: null,
    member: 'Shared', notes: null, exclude_from_runway: false,
    transfer_pair_id: null, transfer_group_id: null,
    created_at: null, imported_at: null, fingerprint: null, payment_method: null,
    ...over
  } as TransactionRow
}

function split(over: Partial<TransactionSplitRow> = {}): TransactionSplitRow {
  return {
    id: 's1', household_id: 'h1', transaction_id: 't1',
    amount: 50, member: 'Shared', category: 'Groceries',
    category_id: 'c-groc', sub_category: null, notes: null,
    exclude_from_runway: null, display_order: 0, created_at: null,
    ...over
  } as TransactionSplitRow
}

describe('expandToEffectiveRows', () => {
  it('returns the parent unchanged when it has no splits', () => {
    const rows = expandToEffectiveRows({ transactions: [tx()], splits: [] })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.transactionId).toBe('t1')
    expect(rows[0]?.splitId).toBeNull()
    expect(rows[0]?.amount).toBe(-100)
  })

  it('suppresses parent and emits one row per split', () => {
    const rows = expandToEffectiveRows({
      transactions: [tx({ id: 't1', amount: -100 })],
      splits: [
        split({ id: 's1', transaction_id: 't1', amount: 60, member: 'Alexis', category: 'Groceries' }),
        split({ id: 's2', transaction_id: 't1', amount: 40, member: 'Marilyn', category: 'Pets' })
      ]
    })
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.transactionId === 't1')).toBe(true)
    expect(rows[0]?.amount).toBe(-60)
    expect(rows[0]?.member).toBe('Alexis')
    expect(rows[1]?.amount).toBe(-40)
    expect(rows[1]?.member).toBe('Marilyn')
  })

  it('preserves parent amount sign on splits', () => {
    // Income transaction has positive parent.amount → split rows positive too
    const rows = expandToEffectiveRows({
      transactions: [tx({ id: 't1', amount: 200, type: 'Income' })],
      splits: [split({ id: 's1', transaction_id: 't1', amount: 200 })]
    })
    expect(rows[0]?.amount).toBe(200)
  })

  it('split exclude_from_runway overrides parent', () => {
    const rows = expandToEffectiveRows({
      transactions: [tx({ id: 't1', exclude_from_runway: false })],
      splits: [
        split({ id: 's1', amount: 60, exclude_from_runway: null }),    // inherits false
        split({ id: 's2', amount: 40, exclude_from_runway: true })     // override
      ]
    })
    expect(rows[0]?.exclude_from_runway).toBe(false)
    expect(rows[1]?.exclude_from_runway).toBe(true)
  })

  it('split exclude_from_runway = null inherits parent', () => {
    const rows = expandToEffectiveRows({
      transactions: [tx({ id: 't1', exclude_from_runway: true })],
      splits: [split({ id: 's1', exclude_from_runway: null })]
    })
    expect(rows[0]?.exclude_from_runway).toBe(true)
  })

  it('respects display_order within a parent\'s splits', () => {
    const rows = expandToEffectiveRows({
      transactions: [tx()],
      splits: [
        split({ id: 's3', display_order: 2, amount: 30, member: 'C' }),
        split({ id: 's1', display_order: 0, amount: 30, member: 'A' }),
        split({ id: 's2', display_order: 1, amount: 40, member: 'B' })
      ]
    })
    expect(rows.map(r => r.member)).toEqual(['A', 'B', 'C'])
  })

  it('mixes split parents with unsplit parents in input order', () => {
    const rows = expandToEffectiveRows({
      transactions: [
        tx({ id: 't1' }),
        tx({ id: 't2' }),
        tx({ id: 't3' })
      ],
      splits: [
        split({ id: 's1', transaction_id: 't2', amount: 50, member: 'A' }),
        split({ id: 's2', transaction_id: 't2', amount: 50, member: 'B' })
      ]
    })
    expect(rows.map(r => r.transactionId)).toEqual(['t1', 't2', 't2', 't3'])
    expect(rows[0]?.splitId).toBeNull()       // t1 unsplit
    expect(rows[1]?.splitId).toBe('s1')       // t2 split
    expect(rows[2]?.splitId).toBe('s2')
    expect(rows[3]?.splitId).toBeNull()       // t3 unsplit
  })

  it('ignores splits whose parent is not in the transactions array', () => {
    const rows = expandToEffectiveRows({
      transactions: [tx({ id: 't1' })],
      splits: [split({ id: 's1', transaction_id: 't-other' })]
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.splitId).toBeNull()
  })
})

describe('splitParentIds', () => {
  it('returns the set of parent transaction ids that have splits', () => {
    const ids = splitParentIds([
      split({ transaction_id: 't1' }),
      split({ transaction_id: 't1' }),
      split({ transaction_id: 't2' })
    ])
    expect(ids.size).toBe(2)
    expect(ids.has('t1')).toBe(true)
    expect(ids.has('t2')).toBe(true)
  })
})
