import { describe, it, expect } from 'vitest'
import { deriveBalances, type AccountRow, type TransactionRow } from './balances'

const HID = '00000000-0000-0000-0000-000000000001'

function account(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'a1',
    household_id: HID,
    name: 'Chase Checking',
    type: 'checking',
    institution: null,
    is_active: true,
    last_four: null,
    starting_balance: 1000,
    starting_balance_date: null,
    archived_at: null,
    currency: 'USD',
    display_order: null,
    created_at: null,
    ...over
  }
}

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: HID,
    date: '2025-05-15',
    description: '',
    amount: 100,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    account_id: 'a1',
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

describe('deriveBalances', () => {
  it('returns zeros when no accounts', () => {
    const out = deriveBalances({ accounts: [], transactions: [] })
    expect(out).toEqual({ accounts: [], totalCash: 0, totalDebt: 0, totalInvestments: 0, netWorth: 0 })
  })

  it('excludes inactive accounts', () => {
    const out = deriveBalances({
      accounts: [account({ is_active: false, starting_balance: 99999 })],
      transactions: []
    })
    expect(out.accounts).toHaveLength(0)
    expect(out.totalCash).toBe(0)
  })

  it('current balance = starting_balance with no activity', () => {
    const out = deriveBalances({
      accounts: [account({ starting_balance: 1500 })],
      transactions: []
    })
    expect(out.accounts[0]!.currentBalance).toBe(1500)
    expect(out.accounts[0]!.activity).toBe(0)
    expect(out.accounts[0]!.txCount).toBe(0)
  })

  it('Expense subtracts from a cash account', () => {
    const out = deriveBalances({
      accounts: [account({ starting_balance: 1000 })],
      transactions: [tx({ amount: 100, type: 'Expense' })]
    })
    expect(out.accounts[0]!.currentBalance).toBe(900)
    expect(out.accounts[0]!.activity).toBe(-100)
  })

  it('Income adds to a cash account', () => {
    const out = deriveBalances({
      accounts: [account({ starting_balance: 1000 })],
      transactions: [tx({ amount: 500, type: 'Income' })]
    })
    expect(out.accounts[0]!.currentBalance).toBe(1500)
  })

  it('Transfer uses raw signed amount', () => {
    const out = deriveBalances({
      accounts: [account({ starting_balance: 1000 })],
      transactions: [
        tx({ id: 't1', amount: -500, type: 'Transfer' }),
        tx({ id: 't2', amount: 200, type: 'Transfer' })
      ]
    })
    // 1000 - 500 + 200 = 700
    expect(out.accounts[0]!.currentBalance).toBe(700)
  })

  it('skips transactions without account_id', () => {
    const out = deriveBalances({
      accounts: [account({ starting_balance: 1000 })],
      transactions: [tx({ account_id: null, amount: 9999 })]
    })
    expect(out.accounts[0]!.currentBalance).toBe(1000)
  })

  it('totalCash sums checking + savings', () => {
    const out = deriveBalances({
      accounts: [
        account({ id: 'a1', type: 'checking', starting_balance: 1000 }),
        account({ id: 'a2', type: 'savings', starting_balance: 5000 }),
        account({ id: 'a3', type: 'credit', starting_balance: 2000 })
      ],
      transactions: []
    })
    expect(out.totalCash).toBe(6000)
  })

  it('totalDebt sums positive credit + loan balances only', () => {
    const out = deriveBalances({
      accounts: [
        account({ id: 'a1', type: 'credit', starting_balance: 2000 }),
        account({ id: 'a2', type: 'loan', starting_balance: 5000 }),
        // Overpaid credit card (negative = household has credit, not debt)
        account({ id: 'a3', type: 'credit', starting_balance: -100 })
      ],
      transactions: []
    })
    expect(out.totalDebt).toBe(7000)
  })

  it('totalInvestments includes investment-type accounts', () => {
    const out = deriveBalances({
      accounts: [
        account({ id: 'a1', type: 'checking', starting_balance: 1000 }),
        account({ id: 'a2', type: 'investment', starting_balance: 50000 })
      ],
      transactions: []
    })
    expect(out.totalInvestments).toBe(50000)
  })

  it('netWorth = totalCash + totalInvestments - totalDebt', () => {
    const out = deriveBalances({
      accounts: [
        account({ id: 'a1', type: 'checking', starting_balance: 10000 }),
        account({ id: 'a2', type: 'investment', starting_balance: 50000 }),
        account({ id: 'a3', type: 'credit', starting_balance: 5000 })
      ],
      transactions: []
    })
    expect(out.netWorth).toBe(55000)
  })

  it('accounts sorted by type then name', () => {
    const out = deriveBalances({
      accounts: [
        account({ id: 'a1', type: 'savings', name: 'Zoo Savings' }),
        account({ id: 'a2', type: 'checking', name: 'Banana Bank' }),
        account({ id: 'a3', type: 'checking', name: 'Apple Bank' })
      ],
      transactions: []
    })
    expect(out.accounts.map(a => a.name)).toEqual(['Apple Bank', 'Banana Bank', 'Zoo Savings'])
  })

  it('null starting_balance treated as 0', () => {
    const out = deriveBalances({
      accounts: [account({ starting_balance: null })],
      transactions: [tx({ amount: 100, type: 'Income' })]
    })
    expect(out.accounts[0]!.currentBalance).toBe(100)
  })

  describe('starting_balance_date filtering', () => {
    it('ignores transactions dated before the anchor', () => {
      const out = deriveBalances({
        accounts: [account({ starting_balance: 5000, starting_balance_date: '2025-01-01' })],
        // Pre-anchor activity should NOT influence the current balance.
        transactions: [
          tx({ id: 't1', date: '2024-06-15', amount: 999, type: 'Expense' }),
          tx({ id: 't2', date: '2025-01-15', amount: 100, type: 'Expense' })
        ]
      })
      expect(out.accounts[0]!.currentBalance).toBe(4900)
      expect(out.accounts[0]!.txCount).toBe(1)
      expect(out.accounts[0]!.activity).toBe(-100)
    })

    it('counts all transactions when starting_balance_date is null', () => {
      const out = deriveBalances({
        accounts: [account({ starting_balance: 5000, starting_balance_date: null })],
        transactions: [
          tx({ id: 't1', date: '2024-06-15', amount: 50, type: 'Expense' }),
          tx({ id: 't2', date: '2025-01-15', amount: 100, type: 'Expense' })
        ]
      })
      expect(out.accounts[0]!.currentBalance).toBe(4850)
      expect(out.accounts[0]!.txCount).toBe(2)
    })

    it('counts a transaction dated exactly on the anchor (>= comparison)', () => {
      const out = deriveBalances({
        accounts: [account({ starting_balance: 1000, starting_balance_date: '2025-01-01' })],
        transactions: [tx({ date: '2025-01-01', amount: 25, type: 'Expense' })]
      })
      expect(out.accounts[0]!.currentBalance).toBe(975)
      expect(out.accounts[0]!.txCount).toBe(1)
    })
  })
})
