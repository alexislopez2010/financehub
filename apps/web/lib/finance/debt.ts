import type { DebtRow } from './types'

export type PayoffStrategy = 'snowball' | 'avalanche' | 'minimum_only'

export interface PayoffOptions {
  strategy: PayoffStrategy
  /** Additional monthly payment beyond every debt's minimum. Floored to 0. */
  extraPerMonth: number
  /** Safety cap to avoid runaway loops. Default 600 months (50 years). */
  maxMonths?: number
}

export interface DebtMonthly {
  debtId: string
  name: string
  /** Total payment for this debt this month (principal portion + escrow + extra applied). */
  payment: number
  /** Portion that reduced principal. */
  principal: number
  /** Interest accrued this month, added to balance after the principal payment. */
  interest: number
  /** Escrow portion of the minimum payment (does not reduce principal). */
  escrow: number
  /** Balance at end of month. */
  balance: number
}

export interface MonthSnapshot {
  /** 1-indexed month from start of simulation. */
  month: number
  perDebt: ReadonlyArray<DebtMonthly>
  /** Sum of `payment` across all debts this month. */
  totalPayment: number
  /** Sum of `principal` across all debts. */
  totalPrincipal: number
  /** Sum of `interest` across all debts. */
  totalInterest: number
  /** Sum of `balance` across all debts at end of month. */
  totalBalance: number
}

export interface PayoffPlan {
  /** Strategy that was simulated. */
  strategy: PayoffStrategy
  /** Per-month snapshots until all debts paid or maxMonths hit. */
  months: ReadonlyArray<MonthSnapshot>
  /** Month index (1..maxMonths) when each debt reached zero balance, by debtId. */
  paidOffByMonth: Record<string, number>
  /** Sum of all interest paid across the simulation. */
  totalInterest: number
  /** Sum of all payments made (principal + escrow + extra; equals total interest + initial balances). */
  totalPaid: number
  /** True if the simulation terminated because all debts were paid. */
  paidOff: boolean
  /** Total months elapsed (length of `months`). */
  monthsToPayoff: number
}

const DEFAULT_MAX_MONTHS = 600

/**
 * Returns the debts in the order they should be attacked with extra payments.
 * snowball  → ascending balance (smallest first)
 * avalanche → descending APR (highest rate first)
 * minimum_only → input order (ordering doesn't matter; no extra applied)
 *
 * Stable secondary sort by name to make tests deterministic.
 */
export function orderDebts(
  debts: ReadonlyArray<{ id: string; name: string; balance: number; apr: number }>,
  strategy: PayoffStrategy
): ReadonlyArray<{ id: string; name: string; balance: number; apr: number }> {
  if (strategy === 'minimum_only') return [...debts]
  const sorted = [...debts]
  if (strategy === 'snowball') {
    sorted.sort((a, b) => a.balance - b.balance || a.name.localeCompare(b.name))
  } else {
    // avalanche
    sorted.sort((a, b) => b.apr - a.apr || a.name.localeCompare(b.name))
  }
  return sorted
}

/**
 * Simulates month-by-month debt payoff.
 *
 * Edge cases:
 *   - debts.length === 0 → returns an empty plan with paidOff=true, monthsToPayoff=0.
 *   - All inactive debts → same as empty.
 *   - extraPerMonth < 0 → treated as 0.
 *   - A debt with balance <= 0 at start → treated as already paid, no payments
 *     recorded for it, paidOffByMonth[debt.id] = 0.
 *   - min_payment > balance → only the remaining balance is paid; no overpayment.
 *   - escrow > min_payment → escrow clamped to min_payment (principal portion floors to 0).
 *   - APR is per-year percent; monthly rate is APR/100/12.
 */
export function simulatePayoff(
  debts: ReadonlyArray<DebtRow>,
  options: PayoffOptions
): PayoffPlan {
  const maxMonths = options.maxMonths ?? DEFAULT_MAX_MONTHS
  const extraPerMonth = Math.max(0, options.extraPerMonth)
  const strategy = options.strategy

  // Working state: mutable copy keyed by id.
  type Working = DebtRow & { paidMonth: number | null }
  const active: Working[] = debts
    .filter(d => d.is_active)
    .map(d => ({ ...d, balance: Math.max(0, d.balance), paidMonth: d.balance <= 0 ? 0 : null }))

  const paidOffByMonth: Record<string, number> = {}
  for (const w of active) {
    if (w.paidMonth === 0) paidOffByMonth[w.id] = 0
  }

  // Short-circuit: no real debt → empty plan.
  const remaining = () => active.filter(w => w.paidMonth === null && w.balance > 0)
  if (remaining().length === 0) {
    return {
      strategy,
      months: [],
      paidOffByMonth,
      totalInterest: 0,
      totalPaid: 0,
      paidOff: true,
      monthsToPayoff: 0
    }
  }

  const months: MonthSnapshot[] = []
  let totalInterest = 0
  let totalPaid = 0

  for (let m = 1; m <= maxMonths; m += 1) {
    // Order at the start of this month based on current balances.
    const orderedIds = orderDebts(
      remaining().map(w => ({ id: w.id, name: w.name, balance: w.balance, apr: w.apr })),
      strategy
    ).map(d => d.id)

    // 1. Apply minimums first to every active debt.
    const perDebt: DebtMonthly[] = []
    for (const w of active) {
      if (w.paidMonth !== null) continue  // already paid in a prior month
      const escrow = Math.max(0, Math.min(w.escrow, w.min_payment))
      const principalCapacity = Math.max(0, w.min_payment - escrow)
      const principal = Math.min(principalCapacity, w.balance)
      const escrowPaid = escrow  // always paid as part of the minimum (even if balance < principalCapacity)
      const payment = principal + escrowPaid
      w.balance = round2(w.balance - principal)
      perDebt.push({
        debtId: w.id,
        name: w.name,
        payment: round2(payment),
        principal: round2(principal),
        interest: 0,  // filled in below
        escrow: round2(escrowPaid),
        balance: w.balance
      })
    }

    // 2. Distribute extra to the first remaining debt(s) in strategy order.
    if (strategy !== 'minimum_only' && extraPerMonth > 0) {
      let leftover = extraPerMonth
      for (const id of orderedIds) {
        if (leftover <= 0) break
        const w = active.find(x => x.id === id)
        if (!w || w.balance <= 0) continue
        const apply = Math.min(leftover, w.balance)
        w.balance = round2(w.balance - apply)
        leftover -= apply
        const row = perDebt.find(r => r.debtId === id)
        if (row) {
          row.principal = round2(row.principal + apply)
          row.payment = round2(row.payment + apply)
        }
      }
    }

    // 3. Apply interest to debts that still have a balance > 0 AFTER payment.
    for (const w of active) {
      if (w.paidMonth !== null) continue
      const monthlyRate = (w.apr / 100) / 12
      const interest = round2(w.balance * monthlyRate)
      w.balance = round2(w.balance + interest)
      const row = perDebt.find(r => r.debtId === w.id)
      if (row) {
        row.interest = interest
        // Update balance to reflect end-of-month state (after interest accrual).
        row.balance = w.balance
      }
      totalInterest = round2(totalInterest + interest)
    }

    // 4. Mark newly-paid debts.
    for (const w of active) {
      if (w.paidMonth === null && w.balance <= 0) {
        w.paidMonth = m
        paidOffByMonth[w.id] = m
      }
    }

    // 5. Aggregate snapshot.
    const totalPayment = round2(perDebt.reduce((s, r) => s + r.payment, 0))
    const totalPrincipal = round2(perDebt.reduce((s, r) => s + r.principal, 0))
    const totalInterestMonth = round2(perDebt.reduce((s, r) => s + r.interest, 0))
    const totalBalance = round2(active.reduce((s, w) => s + Math.max(0, w.balance), 0))
    totalPaid = round2(totalPaid + totalPayment)
    months.push({
      month: m,
      perDebt,
      totalPayment,
      totalPrincipal,
      totalInterest: totalInterestMonth,
      totalBalance
    })

    if (remaining().length === 0) {
      return {
        strategy,
        months,
        paidOffByMonth,
        totalInterest: round2(totalInterest),
        totalPaid,
        paidOff: true,
        monthsToPayoff: m
      }
    }
  }

  // maxMonths exceeded.
  return {
    strategy,
    months,
    paidOffByMonth,
    totalInterest: round2(totalInterest),
    totalPaid,
    paidOff: false,
    monthsToPayoff: maxMonths
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
