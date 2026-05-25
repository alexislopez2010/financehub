import { describe, it, expect } from 'vitest'
import { deriveCfoKpis, type TransactionRow, type DebtRow } from './cfo'
import type { AccountSummary } from './balances'

const TODAY = { year: 2026, month: 6, day: 15 }

function summary(over: Partial<AccountSummary> = {}): AccountSummary {
  return {
    accounts: [],
    totalCash: 50000,
    totalDebt: 10000,
    totalInvestments: 100000,
    netWorth: 140000,
    ...over
  }
}

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1', household_id: 'h', date: '2026-05-15', description: '',
    amount: 100, type: 'Income',
    category: null, category_id: null, account: null, account_id: null,
    created_at: null, fingerprint: null, imported_at: null, member: null,
    notes: null, payment_method: null, sub_category: null,
    transfer_group_id: null, transfer_pair_id: null, ...over
  }
}

function debt(over: Partial<DebtRow> = {}): DebtRow {
  return {
    id: 'd1', household_id: 'h', name: 'Card',
    balance: 5000, apr: 18, min_payment: 100, escrow: 0,
    is_active: true, type: 'credit',
    account_id: null, due_day: null, notes: null,
    original_balance: null, created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z', ...over
  }
}

describe('deriveCfoKpis', () => {
  it('returns zeros when no data', () => {
    const k = deriveCfoKpis({
      summary: summary({ totalCash: 0, totalDebt: 0, netWorth: 0 }),
      transactions: [], debts: [], today: TODAY
    })
    expect(k).toEqual({
      netWorth: 0, ytdIncome: 0, ytdExpense: 0, ytdNet: 0,
      savingsRate: 0, totalDebt: 0, debtToIncomeRatio: 0,
      avgMonthlyExpense: 0, cashRunwayMonths: 0
    })
  })

  it('passes netWorth through from summary', () => {
    const k = deriveCfoKpis({
      summary: summary({ netWorth: 12345.67 }),
      transactions: [], debts: [], today: TODAY
    })
    expect(k.netWorth).toBe(12345.67)
  })

  it('sums YTD income (Income + Refund) but excludes Transfer', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [
        tx({ id: 'a', amount: 5000, type: 'Income' }),
        tx({ id: 'b', amount: 100, type: 'Refund' }),
        tx({ id: 'c', amount: 999, type: 'Transfer' })
      ],
      debts: [], today: TODAY
    })
    expect(k.ytdIncome).toBe(5100)
  })

  it('sums YTD expense, excludes Transfer/Income', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [
        tx({ id: 'a', amount: 200, type: 'Expense' }),
        tx({ id: 'b', amount: 50, type: 'Expense' }),
        tx({ id: 'c', amount: 999, type: 'Transfer' })
      ],
      debts: [], today: TODAY
    })
    expect(k.ytdExpense).toBe(250)
  })

  it('excludes transactions outside the current year', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [
        tx({ id: 'a', amount: 100, type: 'Income', date: '2026-05-15' }),
        tx({ id: 'b', amount: 999, type: 'Income', date: '2025-12-31' })
      ],
      debts: [], today: TODAY
    })
    expect(k.ytdIncome).toBe(100)
  })

  it('savingsRate = ytdNet / ytdIncome (or 0 when no income)', () => {
    const k1 = deriveCfoKpis({
      summary: summary(),
      transactions: [
        tx({ id: 'a', amount: 1000, type: 'Income' }),
        tx({ id: 'b', amount: 200, type: 'Expense' })
      ],
      debts: [], today: TODAY
    })
    expect(k1.savingsRate).toBeCloseTo(0.8, 4)

    const k2 = deriveCfoKpis({
      summary: summary(), transactions: [], debts: [], today: TODAY
    })
    expect(k2.savingsRate).toBe(0)
  })

  it('totalDebt sums positive balances of active debts only', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [],
      debts: [
        debt({ id: 'a', balance: 1000, is_active: true }),
        debt({ id: 'b', balance: 5000, is_active: true }),
        debt({ id: 'c', balance: 9999, is_active: false }),  // inactive
        debt({ id: 'd', balance: -50, is_active: true })     // negative (overpaid)
      ],
      today: TODAY
    })
    expect(k.totalDebt).toBe(6000)
  })

  it('debtToIncomeRatio is debt / income, 0 when no income', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [tx({ amount: 1000, type: 'Income' })],
      debts: [debt({ balance: 250, is_active: true })],
      today: TODAY
    })
    expect(k.debtToIncomeRatio).toBeCloseTo(0.25, 4)
  })

  it('avgMonthlyExpense = ytdExpense / months elapsed', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [
        tx({ amount: 6000, type: 'Expense', date: '2026-05-15' })
      ],
      debts: [],
      today: { year: 2026, month: 6, day: 15 }  // 6 months elapsed
    })
    expect(k.avgMonthlyExpense).toBeCloseTo(1000, 2)
  })

  it('cashRunwayMonths = totalCash / avgMonthlyExpense', () => {
    const k = deriveCfoKpis({
      summary: summary({ totalCash: 12000 }),
      transactions: [tx({ amount: 6000, type: 'Expense' })],
      debts: [],
      today: { year: 2026, month: 6, day: 15 }
    })
    // avgMonthlyExpense = 6000/6 = 1000; 12000/1000 = 12 months
    expect(k.cashRunwayMonths).toBeCloseTo(12, 2)
  })

  it('cashRunwayMonths = 0 when no expense', () => {
    const k = deriveCfoKpis({
      summary: summary(),
      transactions: [], debts: [], today: TODAY
    })
    expect(k.cashRunwayMonths).toBe(0)
  })
})
