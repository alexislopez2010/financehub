import type { BillRow, IncomePlanRow, TransactionRow } from './types'
import { clampDay } from './dueDate'

export interface ForecastPoint {
  /** ISO yyyy-mm-dd. */
  date: string
  /** Projected running balance at END of this day. */
  balance: number
  /** Net change applied this day (income + actuals - expenses - bills). */
  netChange: number
  /** Inflows applied this day (positive sign). */
  inflow: number
  /** Outflows applied this day (positive number; subtract from balance). */
  outflow: number
}

export interface ForecastOptions {
  /** Starting balance at end-of-day BEFORE `startDate` (i.e., before the
   *  first forecast day's transactions are applied). */
  startBalance: number
  /** First day of the forecast (inclusive), ISO yyyy-mm-dd. */
  startDate: string
  /** Number of days to project. Defaults to 30. */
  days?: number
}

interface DateParts {
  year: number
  month: number  // 1..12
  day: number    // 1..31
}

/** Parse 'yyyy-mm-dd' into DateParts. Throws on invalid. */
export function parseISODate(iso: string): DateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new RangeError(`invalid ISO date: ${iso}`)
  const year = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10)
  const day = parseInt(m[3]!, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new RangeError(`invalid ISO date: ${iso}`)
  }
  return { year, month, day }
}

/** Format DateParts back to 'yyyy-mm-dd'. */
export function formatISODate(d: DateParts): string {
  const yyyy = String(d.year).padStart(4, '0')
  const mm = String(d.month).padStart(2, '0')
  const dd = String(d.day).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Increment DateParts by 1 day. */
export function addDay(d: DateParts): DateParts {
  const date = new Date(Date.UTC(d.year, d.month - 1, d.day))
  date.setUTCDate(date.getUTCDate() + 1)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

/**
 * 30-day cash-basis forecast.
 *
 * For each day in [startDate, startDate + days):
 *   1. Sum signed amounts of actual transactions with that date. Convention:
 *      - type 'Income'   → positive contribution (amount as-is)
 *      - type 'Expense'  → negative contribution (subtract abs(amount))
 *      - type 'Refund'   → positive contribution (amount as-is)
 *      - type 'Transfer' → use RAW signed amount (the per-leg sign is
 *        correct in the new schema — transfer_pair_id paired rows have
 *        opposite signs; legacy single-row transfers use the sign as
 *        stored). This matches legacy commit 83a1827.
 *   2. Subtract any bill whose isDueOn(bill, date) is true and is_active.
 *      Each bill contributes -budget_amount (positive number).
 *   3. Add planned income: for an IncomePlanRow that's active and matches
 *      the year+month of the date, distribute expected_amount across the
 *      month per the cadence:
 *      - 'monthly' (or null): one credit on the 1st of the month
 *      - 'semimonthly': two credits — 1st and 15th — each = expected_amount/2
 *      - 'biweekly': every 14 days starting from the 1st of the month,
 *        each = expected_amount / 2 (approximate; matches legacy)
 *      Only the relevant day(s) inside the forecast window receive credits.
 *
 * The starting balance is the END-OF-DAY balance before startDate. The
 * first ForecastPoint records the state at end of startDate after all
 * inflows/outflows for that day.
 *
 * Returns exactly `days` points, even when there's no activity.
 */
export function forecast30Day(
  transactions: ReadonlyArray<TransactionRow>,
  bills: ReadonlyArray<BillRow>,
  incomePlan: ReadonlyArray<IncomePlanRow>,
  options: ForecastOptions
): ReadonlyArray<ForecastPoint> {
  const days = options.days ?? 30
  if (days <= 0) return []

  // Index transactions by date for O(1) lookup per day.
  const txByDate = new Map<string, ReadonlyArray<TransactionRow>>()
  for (const tx of transactions) {
    let list = txByDate.get(tx.date) as TransactionRow[] | undefined
    if (!list) {
      list = []
      txByDate.set(tx.date, list)
    }
    list.push(tx)
  }

  const out: ForecastPoint[] = []
  let cursor = parseISODate(options.startDate)
  let balance = options.startBalance

  for (let i = 0; i < days; i += 1) {
    let inflow = 0
    let outflow = 0
    const dateStr = formatISODate(cursor)

    // 1. Actual transactions on this date.
    const dayTxs = txByDate.get(dateStr) ?? []
    for (const tx of dayTxs) {
      if (tx.type === 'Income' || tx.type === 'Refund') {
        inflow += Math.abs(tx.amount)
      } else if (tx.type === 'Expense') {
        outflow += Math.abs(tx.amount)
      } else if (tx.type === 'Transfer') {
        // RAW signed amount — paired legs cancel; single-row legacy uses storage sign.
        if (tx.amount >= 0) inflow += tx.amount
        else outflow += Math.abs(tx.amount)
      }
    }

    // 2. Scheduled bills due on this date (only if no actual transaction has
    //    already covered them — but cash-basis forecast doesn't try to match;
    //    bills add to outflow regardless. The Briefing's "notable: slipped
    //    bill" feature catches duplication separately).
    for (const b of bills) {
      if (!b.is_active) continue
      if (b.due_day == null) continue
      const clamped = clampDay(b.due_day, cursor.year, cursor.month)
      if (clamped === cursor.day) {
        outflow += b.budget_amount
      }
    }

    // 3. Planned income credits.
    for (const p of incomePlan) {
      if (!p.is_active) continue
      if (p.year !== cursor.year || p.month !== cursor.month) continue
      const cadence = p.cadence ?? 'monthly'
      if (cadence === 'monthly') {
        if (cursor.day === 1) inflow += p.expected_amount
      } else if (cadence === 'semimonthly') {
        if (cursor.day === 1 || cursor.day === 15) inflow += p.expected_amount / 2
      } else if (cadence === 'biweekly') {
        // 1st, 15th, 29th — approximate biweekly. Two credits per month at half each.
        if (cursor.day === 1 || cursor.day === 15) inflow += p.expected_amount / 2
      }
    }

    const netChange = round2(inflow - outflow)
    balance = round2(balance + netChange)
    out.push({
      date: dateStr,
      balance,
      netChange,
      inflow: round2(inflow),
      outflow: round2(outflow)
    })

    cursor = addDay(cursor)
  }

  return out
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
