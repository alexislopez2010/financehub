import type { Tables } from '@/lib/supabase/database.types'
import { signedActivity } from '@/lib/finance/signedActivity'

export type AccountRow = Tables<'accounts'>
export type TransactionRow = Tables<'transactions'>

export interface BriefingKpis {
  /** Sum of cash-type (checking + savings) account balances. */
  cash: number
  /** Sum of credit/loan account balances expressed as a positive number. */
  debt: number
  /** Income + Refund - Expense for the current calendar month. */
  thisMonthNet: number
  /** (monthIncome - monthExpense) / monthIncome. 0 when monthIncome is 0. Range 0..1. */
  savingsRate: number
  /** Average daily expense over the trailing 30 days (dollars/day). */
  burnRate30Day: number
  /** cash / (burnRate30Day * 30). Capped at 99 when burnRate is 0. */
  monthsOfRunway: number
}

export interface BriefingKpisExtras {
  /** Sum of |amount| for Expense transactions this calendar month. */
  monthExpense: number
  /** Sum of |amount| for Income+Refund transactions this calendar month. */
  monthIncome: number
}

export interface DeriveKpisInput {
  accounts: ReadonlyArray<Pick<AccountRow, 'id' | 'type' | 'is_active' | 'starting_balance'>>
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date' | 'account_id'>>
  today: { year: number; month: number; day: number }
}

const CASH_TYPES = new Set(['checking', 'savings'])
const DEBT_TYPES = new Set(['credit', 'loan'])
const RUNWAY_CAP = 99

/**
 * Pure KPI computation for the Briefing.
 *
 * Cash = sum across active cash accounts of:
 *   (starting_balance ?? 0)
 *   + sum of signed activity (Income/Refund positive; Expense negative;
 *     Transfer uses raw signed amount).
 *
 * Debt = sum across active credit/loan accounts of:
 *   (starting_balance ?? 0)            // positive = amount owed
 *   - sum of signed activity            // INVERTED vs cash: a charge
 *                                       // (Expense, signed -$50) raises
 *                                       // debt by $50; a payment (Income,
 *                                       // +$100) lowers debt by $100.
 *
 * Result is then abs'd as a safety net so the tile never renders a
 * negative number even if data is in a weird state.
 *
 * thisMonthNet = (Income + Refund) - Expense for the calendar month.
 *
 * savingsRate = (monthIncome - monthExpense) / monthIncome, or 0 when income=0.
 *
 * burnRate30Day = average daily |Expense| over the trailing 30 days [today-30d, today].
 *
 * monthsOfRunway = cash / (burnRate30Day * 30); capped at 99 when burnRate is 0.
 *
 * Inactive accounts excluded from cash + debt.
 */
export function deriveKpis(input: DeriveKpisInput): BriefingKpis {
  return deriveKpisAndExtras(input).kpis
}

/**
 * Variant of {@link deriveKpis} that also returns the underlying monthly
 * income/expense totals — useful for downstream cards (e.g. Income vs Expense)
 * that would otherwise need to re-iterate the transactions array.
 */
export function deriveKpisAndExtras(
  input: DeriveKpisInput
): { kpis: BriefingKpis; extras: BriefingKpisExtras } {
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
  let trailing30Expense = 0

  // Trailing-30-day cutoff: inclusive window [today - 30d, today].
  const cutoff = subtractDays(input.today, 30)

  for (const tx of input.transactions) {
    // Cash/debt running totals (per-account):
    if (tx.account_id) {
      const signed = signedActivity(tx)
      if (cashAccountIds.has(tx.account_id)) cash += signed
      // DEBT accounts move INVERSELY to signed activity:
      //   charge (Expense, -$50 signed)  → debt +$50 owed
      //   payment (Income, +$100 signed) → debt -$100 owed
      //   refund (Refund, +$30 signed)   → debt -$30 owed
      // See balances.ts for the same inversion on per-account balance math.
      else if (debtAccountIds.has(tx.account_id)) debt -= signed
    }
    const d = parseDate(tx.date)
    if (!d) continue
    // This-month net:
    if (d.year === input.today.year && d.month === input.today.month) {
      if (tx.type === 'Income' || tx.type === 'Refund') monthIncome += Math.abs(tx.amount)
      else if (tx.type === 'Expense') monthExpense += Math.abs(tx.amount)
    }
    // Trailing-30-day burn:
    if (tx.type === 'Expense' && isWithinInclusive(d, cutoff, input.today)) {
      trailing30Expense += Math.abs(tx.amount)
    }
  }

  const cashRounded = round2(cash)
  const debtRounded = round2(Math.abs(debt))
  const burnRate30Day = round2(trailing30Expense / 30)
  const savingsRate =
    monthIncome > 0 ? round(monthIncome > 0 ? (monthIncome - monthExpense) / monthIncome : 0, 4) : 0
  const monthsOfRunway =
    burnRate30Day === 0 ? RUNWAY_CAP : round(cashRounded / (burnRate30Day * 30), 1)

  return {
    kpis: {
      cash: cashRounded,
      debt: debtRounded,
      thisMonthNet: round2(monthIncome - monthExpense),
      savingsRate,
      burnRate30Day,
      monthsOfRunway
    },
    extras: {
      monthIncome: round2(monthIncome),
      monthExpense: round2(monthExpense)
    }
  }
}

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]!, day: +m[3]! }
}

interface Ymd {
  year: number
  month: number
  day: number
}

/** Compare two Ymd dates: negative when a < b, 0 when equal, positive when a > b. */
function compareYmd(a: Ymd, b: Ymd): number {
  if (a.year !== b.year) return a.year - b.year
  if (a.month !== b.month) return a.month - b.month
  return a.day - b.day
}

/** Inclusive range check: lo <= target <= hi. */
function isWithinInclusive(target: Ymd, lo: Ymd, hi: Ymd): boolean {
  return compareYmd(target, lo) >= 0 && compareYmd(target, hi) <= 0
}

/** Subtract `days` days from `ymd` using UTC Date math; returns a new Ymd. */
function subtractDays(ymd: Ymd, days: number): Ymd {
  const ts = Date.UTC(ymd.year, ymd.month - 1, ymd.day) - days * 86_400_000
  const d = new Date(ts)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

function round2(n: number): number {
  return round(n, 2)
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}
