import { describe, it, expect } from 'vitest'
import { deriveKpis, deriveKpisAndExtras } from './kpis'
import type { DeriveKpisInput } from './kpis'

// Minimal account fixture — only the four fields deriveKpis needs.
function mkAccount(
  id: string,
  type: string | null,
  is_active: boolean | null,
  starting_balance: number | null
): DeriveKpisInput['accounts'][number] {
  return { id, type, is_active, starting_balance }
}

// Minimal transaction fixture — only the four fields deriveKpis needs.
function mkTx(
  amount: number,
  type: string,
  date: string,
  account_id: string | null
): DeriveKpisInput['transactions'][number] {
  return { amount, type, date, account_id }
}

const TODAY = { year: 2025, month: 5, day: 15 }

describe('deriveKpis', () => {
  it('returns all zeros for empty inputs', () => {
    const result = deriveKpis({ accounts: [], transactions: [], today: TODAY })
    expect(result).toMatchObject({ cash: 0, debt: 0, thisMonthNet: 0 })
  })

  it('returns all zeros when all accounts are inactive', () => {
    const accounts = [
      mkAccount('a1', 'checking', false, 1000),
      mkAccount('a2', 'credit', null, -500),
    ]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result).toMatchObject({ cash: 0, debt: 0, thisMonthNet: 0 })
  })

  it('returns starting_balance for a single active checking account with no transactions', () => {
    const accounts = [mkAccount('a1', 'checking', true, 2500)]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.cash).toBe(2500)
    expect(result.debt).toBe(0)
    expect(result.thisMonthNet).toBe(0)
  })

  it('handles null starting_balance as zero', () => {
    const accounts = [mkAccount('a1', 'savings', true, null)]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.cash).toBe(0)
  })

  it('returns abs value for a credit account with a negative starting balance', () => {
    // A credit account in the red starts at e.g. -1200 (amount owed).
    const accounts = [mkAccount('c1', 'credit', true, -1200)]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.debt).toBe(1200)
    expect(result.cash).toBe(0)
  })

  it('sums both checking and savings into cash', () => {
    const accounts = [
      mkAccount('a1', 'checking', true, 1000),
      mkAccount('a2', 'savings', true, 500),
    ]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.cash).toBe(1500)
  })

  it('sums both credit and loan into debt', () => {
    const accounts = [
      mkAccount('c1', 'credit', true, -800),
      mkAccount('l1', 'loan', true, -15000),
    ]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.debt).toBe(15800)
  })

  it('computes thisMonthNet correctly — Income + Refund - Expense', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(3000, 'Income', '2025-05-01', 'a1'),
      mkTx(200, 'Refund', '2025-05-10', 'a1'),
      mkTx(800, 'Expense', '2025-05-15', 'a1'),
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.thisMonthNet).toBe(2400)  // 3000 + 200 - 800
  })

  it('excludes transactions from other months from thisMonthNet', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(3000, 'Income', '2025-05-01', 'a1'),   // current month
      mkTx(5000, 'Income', '2025-04-15', 'a1'),   // prev month — excluded
      mkTx(1000, 'Expense', '2025-06-01', 'a1'),  // future month — excluded
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.thisMonthNet).toBe(3000)
  })

  it('excludes transactions from other years from thisMonthNet', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(1000, 'Income', '2025-05-01', 'a1'),
      mkTx(500, 'Income', '2024-05-01', 'a1'),  // same month but different year
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.thisMonthNet).toBe(1000)
  })

  it('adds Income transaction to cash account running total', () => {
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(500, 'Income', '2025-04-01', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.cash).toBe(1500)
  })

  it('subtracts Expense transaction from cash account running total', () => {
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(300, 'Expense', '2025-04-05', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.cash).toBe(700)
  })

  it('adds Refund transaction to cash account running total', () => {
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(100, 'Refund', '2025-04-01', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.cash).toBe(1100)
  })

  it('applies Transfer by raw signed amount to cash account', () => {
    // A debit transfer (money leaving account) should be a negative amount.
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(-200, 'Transfer', '2025-04-01', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.cash).toBe(800)
  })

  it('routes activity to the correct account based on account_id', () => {
    const accounts = [
      mkAccount('cash1', 'checking', true, 2000),
      mkAccount('debt1', 'credit', true, -1000),
    ]
    const transactions = [
      mkTx(500, 'Income', '2025-04-01', 'cash1'),   // adds to cash
      mkTx(200, 'Expense', '2025-04-05', 'debt1'),  // adds to credit (more negative balance)
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.cash).toBe(2500)
    expect(result.debt).toBe(1200)  // abs(-1000 + -200) = 1200
  })

  it('ignores transactions for unknown account_ids', () => {
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(500, 'Income', '2025-05-01', 'unknown-id')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // Cash should not include the transaction since account is unknown,
    // but thisMonthNet still counts it.
    expect(result.cash).toBe(1000)
    expect(result.thisMonthNet).toBe(500)
  })

  it('ignores transactions with null account_id for cash/debt totals', () => {
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(500, 'Income', '2025-04-01', null)]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.cash).toBe(1000)  // no change
  })

  it('rounds results to 2 decimal places', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0.1)]
    const transactions = [mkTx(0.2, 'Income', '2025-05-01', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // 0.1 + 0.2 = 0.30000000000000004 in JS, should round to 0.30
    expect(result.cash).toBe(0.3)
    expect(result.thisMonthNet).toBe(0.2)
  })

  it('Transfer activity does not double-count in thisMonthNet', () => {
    const accounts = [mkAccount('a1', 'checking', true, 2000)]
    const transactions = [
      mkTx(-500, 'Transfer', '2025-05-10', 'a1'),  // debit leg
    ]
    // Transfer should NOT affect thisMonthNet (not Income/Refund/Expense)
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.thisMonthNet).toBe(0)
    expect(result.cash).toBe(1500)  // 2000 - 500
  })

  it('investment accounts are excluded from both cash and debt', () => {
    const accounts = [mkAccount('i1', 'investment', true, 50000)]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.cash).toBe(0)
    expect(result.debt).toBe(0)
  })

  it('savingsRate is positive when income > expense', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(5000, 'Income', '2025-05-01', 'a1'),
      mkTx(2000, 'Expense', '2025-05-10', 'a1'),
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // (5000 - 2000) / 5000 = 0.6
    expect(result.savingsRate).toBe(0.6)
  })

  it('savingsRate is 0 when income is 0', () => {
    const accounts = [mkAccount('a1', 'checking', true, 1000)]
    const transactions = [mkTx(300, 'Expense', '2025-05-10', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.savingsRate).toBe(0)
  })

  it('savingsRate can be negative when expense exceeds income', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(1000, 'Income', '2025-05-01', 'a1'),
      mkTx(1500, 'Expense', '2025-05-10', 'a1'),
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // (1000 - 1500) / 1000 = -0.5
    expect(result.savingsRate).toBe(-0.5)
  })

  it('burnRate30Day includes transaction within the 30-day window', () => {
    // today = 2025-05-15. Cutoff = 2025-04-15. A transaction on 2025-04-15
    // (exactly 30 days back) should be included.
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [mkTx(300, 'Expense', '2025-04-15', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // 300 / 30 = 10/day
    expect(result.burnRate30Day).toBe(10)
  })

  it('burnRate30Day excludes transaction older than 30 days', () => {
    // today = 2025-05-15. Cutoff = 2025-04-15. A transaction on 2025-04-14
    // (31 days back) should be excluded.
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [mkTx(300, 'Expense', '2025-04-14', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    expect(result.burnRate30Day).toBe(0)
  })

  it('burnRate30Day averages multiple Expense transactions across 30 days', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(150, 'Expense', '2025-05-01', 'a1'),
      mkTx(150, 'Expense', '2025-05-10', 'a1'),
      mkTx(300, 'Expense', '2025-05-15', 'a1'),
      // Income should not affect burn rate
      mkTx(1000, 'Income', '2025-05-12', 'a1'),
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // (150 + 150 + 300) / 30 = 20
    expect(result.burnRate30Day).toBe(20)
  })

  it('monthsOfRunway = cash / (burnRate * 30) for the happy path', () => {
    const accounts = [mkAccount('a1', 'checking', true, 6000)]
    const transactions = [
      // 300 of expense in 30 days → burnRate = 10/d → monthly burn = 300
      mkTx(300, 'Expense', '2025-05-01', 'a1'),
    ]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // cash after Expense: 6000 - 300 = 5700; burn = 10 * 30 = 300 → 5700/300 = 19.0
    expect(result.monthsOfRunway).toBe(19)
  })

  it('monthsOfRunway is capped at 99 when burnRate is 0', () => {
    const accounts = [mkAccount('a1', 'checking', true, 10000)]
    const result = deriveKpis({ accounts, transactions: [], today: TODAY })
    expect(result.burnRate30Day).toBe(0)
    expect(result.monthsOfRunway).toBe(99)
  })

  it('monthsOfRunway is 0 when cash is 0 (and burnRate > 0)', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [mkTx(300, 'Expense', '2025-05-01', 'a1')]
    const result = deriveKpis({ accounts, transactions, today: TODAY })
    // cash = 0 - 300 = -300; -300 / 300 = -1.0
    expect(result.monthsOfRunway).toBe(-1)
  })

  it('deriveKpisAndExtras returns matching monthIncome and monthExpense', () => {
    const accounts = [mkAccount('a1', 'checking', true, 0)]
    const transactions = [
      mkTx(3000, 'Income', '2025-05-01', 'a1'),
      mkTx(200, 'Refund', '2025-05-10', 'a1'),
      mkTx(800, 'Expense', '2025-05-15', 'a1'),
      // wrong month — excluded from extras
      mkTx(5000, 'Income', '2025-04-15', 'a1'),
    ]
    const { kpis, extras } = deriveKpisAndExtras({ accounts, transactions, today: TODAY })
    expect(extras.monthIncome).toBe(3200) // 3000 + 200
    expect(extras.monthExpense).toBe(800)
    expect(kpis.thisMonthNet).toBe(2400)
  })
})
