'use client'

import type { Tables } from '@/lib/supabase/database.types'
import type { PayoffPlan } from '@/lib/finance/debt'
import { cn } from '@/lib/cn'

type DebtRow = Tables<'debts'>

export interface DebtListProps {
  debts: ReadonlyArray<DebtRow>
  plan: PayoffPlan
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function monthsLabel(m: number, paidOff: boolean): string {
  if (m === 0 && paidOff) return 'Already paid'
  if (!paidOff) return 'Pending'
  const years = Math.floor(m / 12)
  const rem = m % 12
  if (years === 0) return `${m} month${m === 1 ? '' : 's'}`
  if (rem === 0) return `${years}y`
  return `${years}y ${rem}m`
}

export function DebtList({ debts, plan }: DebtListProps) {
  if (debts.length === 0) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        No debts to pay off — well done.
      </div>
    )
  }

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-rule">
        <h3 className="text-sm font-semibold text-ink">Debts</h3>
        <p className="text-xs text-muted">Payoff month is per current strategy + extra payment</p>
      </header>
      <div className="grid grid-cols-[1fr_80px_100px_110px] sm:grid-cols-[1fr_100px_120px_130px] gap-3 px-4 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted bg-gray-50 border-b border-rule">
        <div>Name</div>
        <div className="text-right">APR</div>
        <div className="text-right">Balance</div>
        <div className="text-right">Paid Off In</div>
      </div>
      <ul className="divide-y divide-gray-100">
        {debts.map(d => {
          const monthIdx = plan.paidOffByMonth[d.id]
          const paid = monthIdx !== undefined
          return (
            <li
              key={d.id}
              className={cn(
                'grid grid-cols-[1fr_80px_100px_110px] sm:grid-cols-[1fr_100px_120px_130px] gap-3 px-4 py-3 text-sm items-center hover:bg-gray-50 transition-colors'
              )}
            >
              <div className="min-w-0">
                <div className="text-ink font-medium truncate">{d.name}</div>
                <div className="text-xs text-muted">
                  Min {formatUSD(d.min_payment ?? 0)}
                  {d.escrow != null && d.escrow > 0 && (
                    <> · escrow {formatUSD(d.escrow)}</>
                  )}
                </div>
              </div>
              <div className="text-right text-xs tabular text-ink">
                {(d.apr ?? 0).toFixed(2)}%
              </div>
              <div className="text-right text-sm tabular font-semibold text-ink">
                {formatUSD(d.balance)}
              </div>
              <div className={cn(
                'text-right text-xs tabular',
                paid ? 'text-emerald-600 font-semibold' : 'text-muted'
              )}>
                {monthsLabel(monthIdx ?? plan.months.length, paid)}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
