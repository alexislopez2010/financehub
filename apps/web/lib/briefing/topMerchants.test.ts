import { describe, it, expect } from 'vitest'
import { deriveTopMerchants, normalizeMerchant } from './topMerchants'
import type { DeriveTopMerchantsInput } from './topMerchants'

function mkTx(
  amount: number,
  type: string,
  date: string,
  description: string
): DeriveTopMerchantsInput['transactions'][number] {
  return { amount, type, date, description }
}

const TODAY = { year: 2025, month: 5 }

describe('deriveTopMerchants', () => {
  it('returns [] for empty transactions', () => {
    const result = deriveTopMerchants({ transactions: [], today: TODAY })
    expect(result).toEqual([])
  })

  it('groups multiple transactions for the same merchant into one row', () => {
    const transactions = [
      mkTx(20, 'Expense', '2025-05-01', 'STARBUCKS'),
      mkTx(15, 'Expense', '2025-05-02', 'STARBUCKS'),
      mkTx(10, 'Expense', '2025-05-03', 'STARBUCKS'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ merchant: 'STARBUCKS', amount: 45, count: 3 })
  })

  it('keeps different merchants in separate rows', () => {
    const transactions = [
      mkTx(20, 'Expense', '2025-05-01', 'STARBUCKS'),
      mkTx(50, 'Expense', '2025-05-02', 'WHOLE FOODS'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(2)
    expect(result[0]!.merchant).toBe('WHOLE FOODS') // sorted by amount desc
    expect(result[1]!.merchant).toBe('STARBUCKS')
  })

  it('collapses "TARGET #1234" and "TARGET #5678" into a single TARGET row', () => {
    const transactions = [
      mkTx(40, 'Expense', '2025-05-01', 'TARGET #1234'),
      mkTx(60, 'Expense', '2025-05-02', 'TARGET #5678'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ merchant: 'TARGET', amount: 100, count: 2 })
  })

  it('normalizes XXXX-suffix card-mask variants', () => {
    const transactions = [
      mkTx(25, 'Expense', '2025-05-01', 'AMAZON XXXX1234'),
      mkTx(30, 'Expense', '2025-05-02', 'AMAZON xxxx5678'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]!.merchant).toBe('AMAZON')
    expect(result[0]!.count).toBe(2)
  })

  it('normalizes *NNN transaction-id suffixes', () => {
    const transactions = [
      mkTx(10, 'Expense', '2025-05-01', 'SQ *COFFEESHOP *1234'),
      mkTx(12, 'Expense', '2025-05-02', 'SQ *COFFEESHOP *5678'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]!.count).toBe(2)
  })

  it('normalizes trailing date stamps (MM/DD)', () => {
    const transactions = [
      mkTx(15, 'Expense', '2025-05-01', 'WALMART 05/12 PURCHASE'),
      mkTx(20, 'Expense', '2025-05-02', 'WALMART 05/15 PURCHASE'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]!.merchant).toBe('WALMART')
  })

  it('limits the output to the requested top N', () => {
    const transactions = [
      mkTx(50, 'Expense', '2025-05-01', 'M1'),
      mkTx(40, 'Expense', '2025-05-02', 'M2'),
      mkTx(30, 'Expense', '2025-05-03', 'M3'),
      mkTx(20, 'Expense', '2025-05-04', 'M4'),
      mkTx(10, 'Expense', '2025-05-05', 'M5'),
      mkTx(5, 'Expense', '2025-05-06', 'M6'),
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY, top: 3 })
    expect(result).toHaveLength(3)
    expect(result.map(r => r.merchant)).toEqual(['M1', 'M2', 'M3'])
  })

  it('ignores non-Expense transactions and other months', () => {
    const transactions = [
      mkTx(100, 'Income', '2025-05-01', 'PAYROLL'), // skip — not Expense
      mkTx(80, 'Expense', '2025-04-01', 'TARGET'), // skip — wrong month
      mkTx(40, 'Expense', '2025-05-01', 'TARGET'), // keep
    ]
    const result = deriveTopMerchants({ transactions, today: TODAY })
    expect(result).toHaveLength(1)
    expect(result[0]!.amount).toBe(40)
  })
})

describe('normalizeMerchant', () => {
  it('uppercases', () => {
    expect(normalizeMerchant('target')).toBe('TARGET')
  })

  it('strips trailing #NNNN tokens', () => {
    expect(normalizeMerchant('TARGET #1234')).toBe('TARGET')
  })

  it('strips trailing bare numeric ids', () => {
    expect(normalizeMerchant('STARBUCKS 1234567')).toBe('STARBUCKS')
  })

  it('strips trailing XXXX suffix', () => {
    expect(normalizeMerchant('AMAZON XXXX1234')).toBe('AMAZON')
  })

  it('strips trailing *NNN suffix', () => {
    expect(normalizeMerchant('SQ *COFFEE *1234')).toBe('SQ *COFFEE')
  })

  it('strips trailing MM/DD date stamps', () => {
    expect(normalizeMerchant('WALMART 05/12 STORE')).toBe('WALMART')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeMerchant('  TARGET    STORE  ')).toBe('TARGET STORE')
  })
})
