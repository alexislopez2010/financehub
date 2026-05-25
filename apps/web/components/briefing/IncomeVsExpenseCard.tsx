'use client'

import { Scale } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface IncomeVsExpenseCardProps {
  monthIncome: number
  monthExpense: number
  className?: string
}

export function IncomeVsExpenseCard({
  monthIncome,
  monthExpense,
  className
}: IncomeVsExpenseCardProps) {
  const isEmpty = monthIncome === 0 && monthExpense === 0
  const max = Math.max(monthIncome, monthExpense, 1)
  const incomePct = (monthIncome / max) * 100
  const expensePct = (monthExpense / max) * 100
  const net = monthIncome - monthExpense

  return (
    <section
      className={cn(
        'bg-surface border border-rule rounded-xl p-5 shadow-sm',
        className
      )}
    >
      <header className="flex items-baseline justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 text-purple-600">
            <Scale size={16} strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-ink">This Month</h2>
        </div>
        <span className="text-xs text-muted">Income vs Expense</span>
      </header>

      {isEmpty ? (
        <p className="text-sm text-muted italic">
          No income or expenses this month yet.
        </p>
      ) : (
        <div className="space-y-3">
          <Row
            label="Income"
            barColor="bg-emerald-500"
            widthPct={incomePct}
            amount={monthIncome}
          />
          <Row
            label="Expense"
            barColor="bg-red-500"
            widthPct={expensePct}
            amount={monthExpense}
          />
          <div className="flex items-baseline justify-between pt-2 border-t border-dotted border-rule">
            <span className="text-xs text-muted uppercase tracking-wide font-semibold">
              Net
            </span>
            <span className={cn('text-sm font-semibold tabular-nums', netToneClass(net))}>
              {formatNet(net)}
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

interface RowProps {
  label: string
  barColor: string
  widthPct: number
  amount: number
}

function Row({ label, barColor, widthPct, amount }: RowProps) {
  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
      <span className="text-sm text-muted">{label}</span>
      <div
        className="bg-rule h-2 rounded-full overflow-hidden"
        aria-hidden="true"
      >
        <div
          className={cn('h-full rounded-full', barColor)}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums text-ink">
        {formatUSD(amount)}
      </span>
    </div>
  )
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

function formatNet(net: number): string {
  if (net === 0) return '$0'
  const abs = Math.abs(net).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
  if (net > 0) return `+${abs}`
  return `−${abs}`
}

function netToneClass(net: number): string {
  if (net > 0) return 'text-emerald-600'
  if (net < 0) return 'text-red-600'
  return 'text-muted'
}
