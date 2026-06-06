import type { Tables } from '@/lib/supabase/database.types'
import type { AccountSummary } from './balances'

export type TransactionRow = Tables<'transactions'>
export type DebtRow = Tables<'debts'>

export interface CfoKpis {
  /** Net worth (from AccountSummary). */
  netWorth: number
  /** Sum of Income + Refund for the YTD period. */
  ytdIncome: number
  /** Sum of Expense for the YTD period. */
  ytdExpense: number
  /** ytdIncome - ytdExpense. */
  ytdNet: number
  /** ytdNet / ytdIncome (decimal, e.g. 0.18 for 18%). 0 if no income. */
  savingsRate: number
  /** Sum of active debt balances (only positive debt balances counted). */
  totalDebt: number
  /** totalDebt / ytdIncome (decimal). 0 if no income. */
  debtToIncomeRatio: number
  /** Average monthly expense over the YTD period (ytdExpense / N months elapsed). */
  avgMonthlyExpense: number
  /** Sum of |amount| on Expense transactions YTD that the user flagged as one-off. */
  excludedYtdExpense: number
  /** ytdExpense - excludedYtdExpense. */
  recurringYtdExpense: number
  /** recurringYtdExpense / N months elapsed. Used for cashRunwayMonths. */
  recurringMonthlyExpense: number
  /** Months of cash runway based on totalCash / recurringMonthlyExpense. 0 if no recurring expense. */
  cashRunwayMonths: number
}

export interface DeriveCfoInput {
  summary: AccountSummary
  transactions: ReadonlyArray<TransactionRow>
  debts: ReadonlyArray<DebtRow>
  today: { year: number; month: number; day: number }
}

/**
 * Pure derivation of CFO-style KPIs for the current year.
 *
 * YTD period = January 1 of the current year through today (inclusive of any
 * transactions dated on or before today, for the current year).
 */
export function deriveCfoKpis(input: DeriveCfoInput): CfoKpis {
  const { summary, transactions, debts, today } = input
  const yearPrefix = `${today.year}-`

  let ytdIncome = 0
  let ytdExpense = 0
  let excludedYtdExpense = 0

  for (const tx of transactions) {
    if (!tx.date.startsWith(yearPrefix)) continue
    if (tx.type === 'Income' || tx.type === 'Refund') {
      ytdIncome += Math.abs(tx.amount)
    } else if (tx.type === 'Expense') {
      const v = Math.abs(tx.amount)
      ytdExpense += v
      // Cash Runway treats user-flagged one-off spend as not part of burn rate.
      // YTD Expense, YTD Net, and savingsRate stay grossed-up (one-offs are
      // real money spent — they just shouldn't roll forward into runway).
      if (tx.exclude_from_runway) excludedYtdExpense += v
    }
  }

  const ytdNet = ytdIncome - ytdExpense
  const savingsRate = ytdIncome > 0 ? ytdNet / ytdIncome : 0

  // Sum positive debt balances (active only — DB column is_active not nullable).
  let totalDebt = 0
  for (const d of debts) {
    if (!d.is_active) continue
    if (d.balance > 0) totalDebt += d.balance
  }

  const debtToIncomeRatio = ytdIncome > 0 ? totalDebt / ytdIncome : 0

  const monthsElapsed = today.month  // 1..12
  const avgMonthlyExpense       = monthsElapsed > 0 ? ytdExpense / monthsElapsed : 0
  const recurringYtdExpense     = ytdExpense - excludedYtdExpense
  const recurringMonthlyExpense = monthsElapsed > 0 ? recurringYtdExpense / monthsElapsed : 0
  const cashRunwayMonths        = recurringMonthlyExpense > 0
    ? summary.totalCash / recurringMonthlyExpense
    : 0

  return {
    netWorth: round2(summary.netWorth),
    ytdIncome: round2(ytdIncome),
    ytdExpense: round2(ytdExpense),
    ytdNet: round2(ytdNet),
    savingsRate: round4(savingsRate),
    totalDebt: round2(totalDebt),
    debtToIncomeRatio: round4(debtToIncomeRatio),
    avgMonthlyExpense: round2(avgMonthlyExpense),
    excludedYtdExpense: round2(excludedYtdExpense),
    recurringYtdExpense: round2(recurringYtdExpense),
    recurringMonthlyExpense: round2(recurringMonthlyExpense),
    cashRunwayMonths: round2(cashRunwayMonths)
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}
