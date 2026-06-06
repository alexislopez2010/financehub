import { describe, it, expect } from 'vitest'
import type { Tables } from '@/lib/supabase/database.types'
import {
  parseSort,
  serializeSort,
  sortTransactions,
  transactionComparator,
  type SortState
} from './sortTransactions'

type TxRow = Tables<'transactions'>

function tx(over: Partial<TxRow> = {}): TxRow {
  return {
    id: 't1',
    household_id: 'h',
    date: '2025-05-15',
    description: 'transaction',
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

const ids = (rows: ReadonlyArray<TxRow>): string[] => rows.map(r => r.id)

describe('parseSort', () => {
  it('valid key + asc → asc', () => {
    expect(parseSort('amount', 'asc')).toEqual({ key: 'amount', dir: 'asc' })
  })

  it('valid key + desc → desc', () => {
    expect(parseSort('date', 'desc')).toEqual({ key: 'date', dir: 'desc' })
  })

  it('valid key + missing dir → desc default', () => {
    expect(parseSort('category', null)).toEqual({ key: 'category', dir: 'desc' })
  })

  it('valid key + garbage dir → desc default', () => {
    expect(parseSort('member', 'sideways')).toEqual({ key: 'member', dir: 'desc' })
  })

  it('invalid key → null', () => {
    expect(parseSort('bogus', 'asc')).toBeNull()
  })

  it('null sort param → null', () => {
    expect(parseSort(null, 'asc')).toBeNull()
  })
})

describe('serializeSort', () => {
  it('writes sort + dir', () => {
    const p = new URLSearchParams()
    serializeSort({ key: 'amount', dir: 'asc' }, p)
    expect(p.get('sort')).toBe('amount')
    expect(p.get('dir')).toBe('asc')
  })

  it('null → writes nothing', () => {
    const p = new URLSearchParams()
    serializeSort(null, p)
    expect(p.toString()).toBe('')
  })
})

describe('sortTransactions — null sort', () => {
  it('returns input unchanged when sort is null', () => {
    const rows = [tx({ id: 'a' }), tx({ id: 'b' })]
    const out = sortTransactions(rows, null)
    expect(out).toBe(rows) // same reference
  })
})

describe('sortTransactions — amount', () => {
  // signedActivity: Income/Refund → +|amt|, Expense → -|amt|, Transfer → raw
  const rows = [
    tx({ id: 'income', type: 'Income', amount: 500, date: '2025-01-01' }),
    tx({ id: 'small-exp', type: 'Expense', amount: 50, date: '2025-01-02' }),
    tx({ id: 'big-exp', type: 'Expense', amount: 2000, date: '2025-01-03' })
  ]

  it('desc → biggest signed first (income), most negative last', () => {
    const out = sortTransactions(rows, { key: 'amount', dir: 'desc' })
    expect(ids(out)).toEqual(['income', 'small-exp', 'big-exp'])
  })

  it('asc → most negative first', () => {
    const out = sortTransactions(rows, { key: 'amount', dir: 'asc' })
    expect(ids(out)).toEqual(['big-exp', 'small-exp', 'income'])
  })

  it('identical signed amounts → tiebreak by date desc', () => {
    const a = tx({ id: 'a', type: 'Expense', amount: 2000, date: '2025-01-10' })
    const b = tx({ id: 'b', type: 'Expense', amount: 2000, date: '2025-03-10' })
    const c = tx({ id: 'c', type: 'Expense', amount: 2000, date: '2025-02-10' })
    const out = sortTransactions([a, b, c], { key: 'amount', dir: 'desc' })
    // all -2000, so primary equal → date desc: March, Feb, Jan
    expect(ids(out)).toEqual(['b', 'c', 'a'])
  })

  it('clusters identical signed amounts adjacently (mortgage case)', () => {
    const rows = [
      tx({ id: 'm-jan', type: 'Expense', amount: 2000, date: '2025-01-01' }),
      tx({ id: 'groceries', type: 'Expense', amount: 80, date: '2025-02-05' }),
      tx({ id: 'm-mar', type: 'Expense', amount: 2000, date: '2025-03-01' }),
      tx({ id: 'gas', type: 'Expense', amount: 40, date: '2025-02-10' }),
      tx({ id: 'm-feb', type: 'Expense', amount: 2000, date: '2025-02-01' })
    ]
    const out = sortTransactions(rows, { key: 'amount', dir: 'desc' })
    const sortedIds = ids(out)
    const mortgageIdxs = ['m-jan', 'm-feb', 'm-mar']
      .map(id => sortedIds.indexOf(id))
      .sort((x, y) => x - y)
    const first = mortgageIdxs[0] ?? -1
    const last = mortgageIdxs[mortgageIdxs.length - 1] ?? -1
    // the three mortgage rows occupy contiguous positions
    expect(last - first).toBe(2)
  })
})

describe('sortTransactions — date', () => {
  const rows = [
    tx({ id: 'mid', date: '2025-02-15' }),
    tx({ id: 'old', date: '2025-01-01' }),
    tx({ id: 'new', date: '2025-03-30' })
  ]

  it('asc → oldest first', () => {
    expect(ids(sortTransactions(rows, { key: 'date', dir: 'asc' }))).toEqual([
      'old',
      'mid',
      'new'
    ])
  })

  it('desc → newest first', () => {
    expect(ids(sortTransactions(rows, { key: 'date', dir: 'desc' }))).toEqual([
      'new',
      'mid',
      'old'
    ])
  })
})

describe('sortTransactions — description (case-insensitive)', () => {
  const rows = [
    tx({ id: 'b', description: 'banana', date: '2025-01-01' }),
    tx({ id: 'A', description: 'Apple', date: '2025-01-02' }),
    tx({ id: 'c', description: 'cherry', date: '2025-01-03' })
  ]

  it('asc → alphabetical ignoring case', () => {
    expect(ids(sortTransactions(rows, { key: 'description', dir: 'asc' }))).toEqual([
      'A',
      'b',
      'c'
    ])
  })

  it('desc → reverse alphabetical ignoring case', () => {
    expect(ids(sortTransactions(rows, { key: 'description', dir: 'desc' }))).toEqual([
      'c',
      'b',
      'A'
    ])
  })
})

describe('sortTransactions — category null/empty sorts last', () => {
  const rows = [
    tx({ id: 'food', category: 'Food', date: '2025-01-01' }),
    tx({ id: 'none', category: null, date: '2025-01-02' }),
    tx({ id: 'rent', category: 'Rent', date: '2025-01-03' })
  ]

  it('asc → nulls last', () => {
    expect(ids(sortTransactions(rows, { key: 'category', dir: 'asc' }))).toEqual([
      'food',
      'rent',
      'none'
    ])
  })

  it('desc → nulls STILL last', () => {
    expect(ids(sortTransactions(rows, { key: 'category', dir: 'desc' }))).toEqual([
      'rent',
      'food',
      'none'
    ])
  })

  it('treats empty-string category as null (last)', () => {
    const withEmpty = [
      tx({ id: 'food', category: 'Food', date: '2025-01-01' }),
      tx({ id: 'blank', category: '   ', date: '2025-01-02' })
    ]
    expect(ids(sortTransactions(withEmpty, { key: 'category', dir: 'desc' }))).toEqual([
      'food',
      'blank'
    ])
  })
})

describe('sortTransactions — member null sorts last in both directions', () => {
  const rows = [
    tx({ id: 'ana', member: 'Ana', date: '2025-01-01' }),
    tx({ id: 'unassigned', member: null, date: '2025-01-02' }),
    tx({ id: 'leo', member: 'Leo', date: '2025-01-03' })
  ]

  it('asc → null last', () => {
    expect(ids(sortTransactions(rows, { key: 'member', dir: 'asc' }))).toEqual([
      'ana',
      'leo',
      'unassigned'
    ])
  })

  it('desc → null last', () => {
    expect(ids(sortTransactions(rows, { key: 'member', dir: 'desc' }))).toEqual([
      'leo',
      'ana',
      'unassigned'
    ])
  })
})

describe('sortTransactions — account', () => {
  const rows = [
    tx({ id: 'checking', account: 'Checking', date: '2025-01-01' }),
    tx({ id: 'none', account: null, date: '2025-01-02' }),
    tx({ id: 'amex', account: 'Amex', date: '2025-01-03' })
  ]

  it('asc → alphabetical, null last', () => {
    expect(ids(sortTransactions(rows, { key: 'account', dir: 'asc' }))).toEqual([
      'amex',
      'checking',
      'none'
    ])
  })
})

describe('sortTransactions — type', () => {
  const rows = [
    tx({ id: 'transfer', type: 'Transfer', date: '2025-01-01' }),
    tx({ id: 'expense', type: 'Expense', date: '2025-01-02' }),
    tx({ id: 'income', type: 'Income', date: '2025-01-03' })
  ]

  it('asc → alphabetical by type string', () => {
    expect(ids(sortTransactions(rows, { key: 'type', dir: 'asc' }))).toEqual([
      'expense',
      'income',
      'transfer'
    ])
  })

  it('desc → reverse', () => {
    expect(ids(sortTransactions(rows, { key: 'type', dir: 'desc' }))).toEqual([
      'transfer',
      'income',
      'expense'
    ])
  })
})

describe('sortTransactions — purity', () => {
  it('does NOT mutate the input array', () => {
    const rows = [
      tx({ id: 'a', amount: 10, type: 'Expense' }),
      tx({ id: 'b', amount: 99, type: 'Income' }),
      tx({ id: 'c', amount: 5, type: 'Expense' })
    ]
    const before = ids(rows)
    sortTransactions(rows, { key: 'amount', dir: 'desc' })
    expect(ids(rows)).toEqual(before) // original order preserved
  })

  it('transactionComparator alone never mutates rows', () => {
    const a = tx({ id: 'a', amount: 1 })
    const b = tx({ id: 'b', amount: 2 })
    const cmp = transactionComparator({ key: 'amount', dir: 'asc' } as SortState)
    cmp(a, b)
    expect(a.id).toBe('a')
    expect(b.id).toBe('b')
  })
})
