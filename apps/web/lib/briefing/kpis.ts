import type { Tables } from '@/lib/supabase/database.types'

export type AccountRow = Tables<'accounts'>
export type TransactionRow = Tables<'transactions'>

export interface BriefingKpis {
  /** Sum of cash-type (checking + savings) account balances. */
  cash: number
  /** Sum of credit/loan account balances expressed as a positive number. */
  debt: number
  /** Income + Refund - Expense for the current calendar month. */
  thisMonthNet: number
}

export interface DeriveKpisInput {
  accounts: ReadonlyArray<Pick<AccountRow, 'id' | 'type' | 'is_active' | 'starting_balance'>>
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date' | 'account_id'>>
  today: { year: number; month: number }
}

const CASH_TYPES = new Set(['checking', 'savings'])
const DEBT_TYPES = new Set(['credit', 'loan'])

/**
 * Pure KPI computation for the Briefing.
 *
 * Cash = sum across active cash accounts of:
 *   (starting_balance ?? 0)
 *   + sum of signed activity (Income/Refund positive; Expense negative;
 *     Transfer uses raw signed amount).
 *
 * Debt = same calculation across credit/loan accounts, then negated/abs'd
 * so the result is a positive number representing what's owed.
 *
 * thisMonthNet = (Income + Refund) - Expense for the calendar month.
 *
 * Inactive accounts excluded from cash + debt.
 */
export function deriveKpis(input: DeriveKpisInput): BriefingKpis {
  const cashAccountIds = new Set<string>()
  const debtAccountIds = new Set<string>()
  let cash = 0
  let debt = 0

  for (const a of input.accounts) {
    if (!a.is_active) continue
    if (a.type && CASH_TYPES.has(a.type)) {
      cashAccountIds.add(a.id)
      cash += a.starting_balance ?? 0
    } else if (a.type && DEBT_TYPES.has(a.type)) {
      debtAccountIds.add(a.id)
      debt += a.starting_balance ?? 0
    }
  }

  let monthIncome = 0
  let monthExpense = 0

  for (const tx of input.transactions) {
    // Cash/debt running totals (per-account):
    if (tx.account_id) {
      const signed = signedActivity(tx)
      if (cashAccountIds.has(tx.account_id)) cash += signed
      else if (debtAccountIds.has(tx.account_id)) debt += signed
    }
    // This-month net:
    const d = parseDate(tx.date)
    if (d && d.year === input.today.year && d.month === input.today.month) {
      if (tx.type === 'Income' || tx.type === 'Refund') monthIncome += Math.abs(tx.amount)
      else if (tx.type === 'Expense') monthExpense += Math.abs(tx.amount)
    }
  }

  return {
    cash: round2(cash),
    debt: round2(Math.abs(debt)),
    thisMonthNet: round2(monthIncome - monthExpense)
  }
}

function signedActivity(tx: Pick<TransactionRow, 'amount' | 'type'>): number {
  if (tx.type === 'Income' || tx.type === 'Refund') return Math.abs(tx.amount)
  if (tx.type === 'Expense') return -Math.abs(tx.amount)
  // Transfer: raw signed amount (per the 2D forecast contract).
  return tx.amount
}

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]!, day: +m[3]! }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
