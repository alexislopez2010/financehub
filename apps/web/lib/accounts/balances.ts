import type { Tables } from '@/lib/supabase/database.types'

export type AccountRow = Tables<'accounts'>
export type TransactionRow = Tables<'transactions'>

export interface AccountBalance {
  accountId: string
  /** Account name for display. */
  name: string
  /** Account type. */
  type: string | null
  /**
   * Designated owner of the account. Either a household_member display_name,
   * the literal 'Shared', or null when unassigned.
   */
  owner: string | null
  /** Sum: starting_balance + signed activity to today. */
  currentBalance: number
  /** Activity portion of the balance (currentBalance - starting_balance). */
  activity: number
  /** Number of transactions counted in the activity. */
  txCount: number
}

export interface AccountSummary {
  /** Active accounts in alphabetical-by-type-then-name order. */
  accounts: ReadonlyArray<AccountBalance>
  /** Sum of currentBalance across cash account types (checking + savings). */
  totalCash: number
  /** Absolute sum of currentBalance across debt account types (credit + loan).
   *  Negative or zero balances are treated as zero in this total; positive means
   *  "amount owed" (legacy app stores credit cards as positive when balance is owed). */
  totalDebt: number
  /** Sum across investment accounts. */
  totalInvestments: number
  /** Net worth: totalCash + totalInvestments - totalDebt. */
  netWorth: number
}

// Keep aligned with briefing/kpis.ts. `property` joins the investment
// bucket so totalInvestments is really "totalAssets" (illiquid value:
// real estate + brokerage). Mortgage joins the debt bucket so totalDebt
// captures the full liability picture.
const CASH_TYPES = new Set(['checking', 'savings', 'cash'])
const DEBT_TYPES = new Set(['credit', 'loan', 'mortgage'])
const INVESTMENT_TYPES = new Set(['investment', 'property', 'asset'])

/**
 * Pure derivation of per-account current balance + household summary.
 *
 * Activity convention (matches lib/briefing/kpis):
 *   Income/Refund → +abs(amount)
 *   Expense       → -abs(amount)
 *   Transfer      → raw signed amount (paired legs cancel; single-leg uses stored sign)
 *
 * Inactive accounts (is_active === false) are excluded.
 */
export function deriveBalances(input: {
  accounts: ReadonlyArray<AccountRow>
  transactions: ReadonlyArray<TransactionRow>
}): AccountSummary {
  // Build a lookup so we can consult each account's starting_balance_date
  // while aggregating activity. Transactions dated BEFORE the anchor are
  // excluded from the current balance — they are considered pre-history.
  const accountById = new Map<string, AccountRow>()
  for (const a of input.accounts) accountById.set(a.id, a)

  // Aggregate activity per account_id.
  const activityByAccount = new Map<string, { sum: number; count: number }>()
  for (const tx of input.transactions) {
    if (!tx.account_id) continue
    const account = accountById.get(tx.account_id)
    if (account?.starting_balance_date && tx.date < account.starting_balance_date) continue
    const signed = signedActivity(tx)
    const entry = activityByAccount.get(tx.account_id) ?? { sum: 0, count: 0 }
    entry.sum += signed
    entry.count += 1
    activityByAccount.set(tx.account_id, entry)
  }

  const accounts: AccountBalance[] = []
  let totalCash = 0
  let totalDebt = 0
  let totalInvestments = 0

  for (const a of input.accounts) {
    if (a.is_active === false) continue
    const starting = a.starting_balance ?? 0
    const activity = activityByAccount.get(a.id)
    const sum = activity?.sum ?? 0
    const count = activity?.count ?? 0
    // For DEBT accounts (credit/loan), signed activity flows in the
    // opposite direction from the balance: a charge (Expense, signed -$50)
    // INCREASES debt by $50; a payment (Income, +$100) DECREASES debt by $100.
    // For CASH accounts, signed activity moves balance directly.
    const isDebt = a.type ? DEBT_TYPES.has(a.type) : false
    const currentBalance = round2(isDebt ? starting - sum : starting + sum)
    accounts.push({
      accountId: a.id,
      name: a.name,
      type: a.type,
      owner: a.owner ?? null,
      currentBalance,
      activity: round2(sum),
      txCount: count
    })

    if (a.type && CASH_TYPES.has(a.type)) totalCash += currentBalance
    else if (a.type && DEBT_TYPES.has(a.type)) {
      // Convention: positive balance on a credit/loan account = amount owed.
      // Negative would mean overpayment / credit balance — treat as zero for "debt".
      if (currentBalance > 0) totalDebt += currentBalance
    } else if (a.type && INVESTMENT_TYPES.has(a.type)) totalInvestments += currentBalance
  }

  // Sort: alphabetical by type then name for deterministic UI.
  accounts.sort((a, b) => {
    const tA = a.type ?? ''
    const tB = b.type ?? ''
    if (tA !== tB) return tA.localeCompare(tB)
    return a.name.localeCompare(b.name)
  })

  return {
    accounts,
    totalCash: round2(totalCash),
    totalDebt: round2(totalDebt),
    totalInvestments: round2(totalInvestments),
    netWorth: round2(totalCash + totalInvestments - totalDebt)
  }
}

function signedActivity(tx: Pick<TransactionRow, 'amount' | 'type'>): number {
  if (tx.type === 'Income' || tx.type === 'Refund') return Math.abs(tx.amount)
  if (tx.type === 'Expense') return -Math.abs(tx.amount)
  return tx.amount  // Transfer
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
