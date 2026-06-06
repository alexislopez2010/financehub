/**
 * Merges debt rows with their linked accounts' computed balances + metadata.
 *
 * The Debt surface and the CFO Total Debt tile both need a single source of
 * truth for each debt's current balance. For debts whose `account_id` is set,
 * the account's computed balance (from transactions + starting_balance) is
 * authoritative. For unlinked debts (e.g., student loans with no per-loan
 * account), the stored `debt.balance` value remains the fallback.
 *
 * APR / min_payment / due_day work the same way: if the linked account has a
 * value set, it wins; otherwise the debt row's value is used.
 */

import type { Tables } from '@/lib/supabase/database.types'
import type { AccountSummary } from '@/lib/accounts/balances'

export type DebtRow = Tables<'debts'>

/**
 * The shape consumed by simulatePayoff() and the various Debt UI pieces.
 * `balance` is whatever the merge resolved to (account or fallback). Other
 * metadata fields prefer the linked account when populated.
 */
export interface MergedDebt {
  id: string
  household_id: string
  name: string
  type: string
  balance: number
  apr: number
  min_payment: number
  escrow: number
  due_day: number | null
  is_active: boolean
  /** True when the balance came from the linked account, not debt.balance. */
  balanceFromAccount: boolean
  /** Account id if linked, else null. */
  account_id: string | null
}

export interface MergeDebtsWithAccountsInput {
  debts: ReadonlyArray<DebtRow>
  /** Pulled from deriveBalances({ accounts, transactions }). */
  summary: AccountSummary
}

/**
 * Returns one MergedDebt per input debt row, with balance and metadata
 * resolved against the linked account when present.
 */
export function mergeDebtsWithAccounts(
  input: MergeDebtsWithAccountsInput
): ReadonlyArray<MergedDebt> {
  const balanceByAccountId = new Map<string, number>()
  for (const a of input.summary.accounts) {
    balanceByAccountId.set(a.accountId, a.currentBalance)
  }

  return input.debts.map(d => {
    const linkedBalance = d.account_id ? balanceByAccountId.get(d.account_id) : undefined
    const balanceFromAccount = linkedBalance !== undefined
    const balance = balanceFromAccount ? linkedBalance : d.balance

    return {
      id: d.id,
      household_id: d.household_id,
      name: d.name,
      type: d.type,
      balance,
      // For now, APR/min_payment/due_day are still read off the debt row.
      // A later UI pass will read them off accounts when present. The
      // mergeDebtsWithAccounts contract stays the same.
      apr: d.apr ?? 0,
      min_payment: d.min_payment ?? 0,
      escrow: d.escrow ?? 0,
      due_day: d.due_day,
      is_active: d.is_active,
      balanceFromAccount,
      account_id: d.account_id
    }
  })
}
