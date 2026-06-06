import { describe, expect, it } from 'vitest'
import { mergeDebtsWithAccounts, type DebtRow } from './debtAccountMerge'
import type { AccountSummary } from '@/lib/accounts/balances'

function mkDebt(over: Partial<DebtRow> = {}): DebtRow {
  return {
    id: 'd1',
    household_id: 'h1',
    name: 'Test debt',
    type: 'credit_card',
    balance: 1000,
    apr: 20,
    min_payment: 50,
    escrow: null,
    due_day: 15,
    is_active: true,
    account_id: null,
    notes: null,
    original_balance: null,
    created_at: null,
    updated_at: null,
    ...over
  } as DebtRow
}

function mkSummary(rows: ReadonlyArray<{ accountId: string; currentBalance: number }>): AccountSummary {
  return {
    accounts: rows.map(r => ({
      accountId: r.accountId,
      name: 'n',
      type: 'credit',
      owner: null,
      currentBalance: r.currentBalance,
      activity: 0,
      txCount: 0
    })),
    totalCash: 0,
    totalDebt: 0,
    totalInvestments: 0,
    netWorth: 0
  }
}

describe('mergeDebtsWithAccounts', () => {
  it('overrides debt.balance with the linked account computed balance', () => {
    const merged = mergeDebtsWithAccounts({
      debts: [mkDebt({ account_id: 'a1', balance: 0 })],
      summary: mkSummary([{ accountId: 'a1', currentBalance: 2089.48 }])
    })
    expect(merged[0]?.balance).toBe(2089.48)
    expect(merged[0]?.balanceFromAccount).toBe(true)
  })

  it('falls back to debt.balance when account_id is null', () => {
    const merged = mergeDebtsWithAccounts({
      debts: [mkDebt({ account_id: null, balance: 12345 })],
      summary: mkSummary([])
    })
    expect(merged[0]?.balance).toBe(12345)
    expect(merged[0]?.balanceFromAccount).toBe(false)
  })

  it('falls back to debt.balance when account_id is set but no matching account', () => {
    const merged = mergeDebtsWithAccounts({
      debts: [mkDebt({ account_id: 'missing', balance: 999 })],
      summary: mkSummary([{ accountId: 'other', currentBalance: 1 }])
    })
    expect(merged[0]?.balance).toBe(999)
    expect(merged[0]?.balanceFromAccount).toBe(false)
  })

  it('preserves APR/min_payment/escrow with null-safe defaults', () => {
    const merged = mergeDebtsWithAccounts({
      debts: [mkDebt({ apr: null, min_payment: null, escrow: null })],
      summary: mkSummary([])
    })
    expect(merged[0]?.apr).toBe(0)
    expect(merged[0]?.min_payment).toBe(0)
    expect(merged[0]?.escrow).toBe(0)
  })

  it('handles a mix of linked and unlinked debts', () => {
    const merged = mergeDebtsWithAccounts({
      debts: [
        mkDebt({ id: 'd1', account_id: 'a1', balance: 0 }),
        mkDebt({ id: 'd2', account_id: null, balance: 5000 })
      ],
      summary: mkSummary([{ accountId: 'a1', currentBalance: 1500 }])
    })
    expect(merged[0]?.balance).toBe(1500)
    expect(merged[0]?.balanceFromAccount).toBe(true)
    expect(merged[1]?.balance).toBe(5000)
    expect(merged[1]?.balanceFromAccount).toBe(false)
  })
})
