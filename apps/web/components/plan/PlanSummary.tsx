'use client'

import { useMemo } from 'react'
import { Wallet, TrendingUp } from 'lucide-react'
import { KpiTile } from '@/components/ui/KpiTile'
import { useBudgets } from '@/lib/data/budgets'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { useTransactions } from '@/lib/data/transactions'
import { deriveBudgetVsActual } from '@/lib/plan/budgetVsActual'
import { matchIncome } from '@/lib/finance/incomeMatching'
import { periodToRange, type PlanPeriod } from '@/lib/plan/period'

export interface PlanSummaryProps {
  period: PlanPeriod
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function PlanSummary({ period }: PlanSummaryProps) {
  const budgetsQ = useBudgets(period)
  const range = periodToRange(period)
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const incomeQ = useIncomePlan({ year: period.year })

  // Budget side
  const budgetRows = useMemo(() => deriveBudgetVsActual({
    budgets: budgetsQ.data ?? [],
    transactions: txsQ.data ?? [],
    period
  }), [budgetsQ.data, txsQ.data, period])

  const totalBudgeted = budgetRows.reduce((s, r) => s + r.budgeted, 0)
  const totalSpent = budgetRows.reduce((s, r) => s + r.actual, 0)
  const remaining = totalBudgeted - totalSpent
  const overBudget = remaining < 0

  // Income side
  const monthPlans = (incomeQ.data ?? []).filter(p => p.month === period.month)
  const matchResults = useMemo(() => matchIncome(
    monthPlans as unknown as Parameters<typeof matchIncome>[0],
    (txsQ.data ?? []) as unknown as Parameters<typeof matchIncome>[1],
    { year: period.year, months: [period.month] }
  ), [monthPlans, txsQ.data, period])

  const totalPlanned = monthPlans.reduce((s, p) => s + p.expected_amount, 0)
  const totalReceived = matchResults.reduce((s, r) => s + r.actual, 0)
  const receivedDelta = totalReceived - totalPlanned

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <KpiTile
        label="Budget Remaining"
        value={overBudget ? `−${formatUSD(Math.abs(remaining))}` : formatUSD(remaining)}
        caption={
          totalBudgeted > 0
            ? `${formatUSD(totalSpent)} spent of ${formatUSD(totalBudgeted)}`
            : 'No budgets set'
        }
        captionTone={overBudget ? 'negative' : 'neutral'}
        icon={Wallet}
        iconTone={overBudget ? 'red' : 'blue'}
      />
      <KpiTile
        label="Income Received"
        value={formatUSD(totalReceived)}
        caption={
          totalPlanned > 0
            ? receivedDelta >= 0
              ? `${formatUSD(receivedDelta)} ahead of plan`
              : `${formatUSD(Math.abs(receivedDelta))} short of plan`
            : 'No income planned'
        }
        captionTone={
          totalPlanned > 0
            ? receivedDelta >= 0 ? 'positive' : 'negative'
            : 'neutral'
        }
        icon={TrendingUp}
        iconTone="emerald"
      />
    </div>
  )
}
