'use client'

import { useMemo } from 'react'
import { Wallet, TrendingUp, AlertTriangle, PiggyBank } from 'lucide-react'
import { KpiTile, type CaptionTone, type IconTone } from '@/components/ui/KpiTile'
import { useBudgets } from '@/lib/data/budgets'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { useTransactions } from '@/lib/data/transactions'
import {
  deriveBudgetVsActual,
  type BudgetVsActualRow
} from '@/lib/plan/budgetVsActual'
import { matchIncome } from '@/lib/finance/incomeMatching'
import { periodToRange, type PlanPeriod } from '@/lib/plan/period'

export interface PlanSummaryProps {
  period: PlanPeriod
}

/**
 * Aggregated KPI metrics for the Plan surface. Computed once at the page
 * level so the presentational `PlanSummaryTiles` component stays pure.
 */
export interface PlanSummaryMetrics {
  actualSpend: number
  budgeted: number
  actualIncome: number
  plannedIncome: number
  overCount: number
  underCount: number
  totalOverage: number
  totalRemaining: number
  plannedSavings: number
  actualSavings: number
  savingsDelta: number
}

export function computePlanSummaryMetrics(input: {
  budgetRows: ReadonlyArray<BudgetVsActualRow>
  actualIncome: number
  plannedIncome: number
}): PlanSummaryMetrics {
  const { budgetRows, actualIncome, plannedIncome } = input
  const actualSpend = budgetRows.reduce((s, r) => s + r.actual, 0)
  const budgeted = budgetRows.reduce((s, r) => s + r.budgeted, 0)
  const overRows = budgetRows.filter(r => r.budgeted > 0 && r.variance < 0)
  const underRows = budgetRows.filter(r => r.budgeted > 0 && r.variance >= 0)
  const totalOverage = overRows.reduce((s, r) => s - r.variance, 0)
  const totalRemaining = underRows.reduce((s, r) => s + r.variance, 0)
  const plannedSavings = plannedIncome - budgeted
  const actualSavings = actualIncome - actualSpend
  const savingsDelta = actualSavings - plannedSavings
  return {
    actualSpend,
    budgeted,
    actualIncome,
    plannedIncome,
    overCount: overRows.length,
    underCount: underRows.length,
    totalOverage,
    totalRemaining,
    plannedSavings,
    actualSavings,
    savingsDelta
  }
}

function formatUSDCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatUSDSigned(n: number): string {
  if (n > 0) return `+${formatUSDCompact(n)}`
  return formatUSDCompact(n)
}

interface SpendVsBudgetTone {
  caption: string
  tone: CaptionTone
  iconTone: IconTone
}

function spendVsBudgetView(m: PlanSummaryMetrics): SpendVsBudgetTone {
  if (m.budgeted <= 0) {
    return { caption: 'no budget set', tone: 'neutral', iconTone: 'gray' }
  }
  const over = m.actualSpend - m.budgeted
  if (over > 0) {
    return {
      caption: `${formatUSDCompact(over)} over`,
      tone: 'negative',
      iconTone: 'red'
    }
  }
  if (m.actualSpend === 0) {
    return {
      caption: `of ${formatUSDCompact(m.budgeted)} budgeted`,
      tone: 'neutral',
      iconTone: 'blue'
    }
  }
  return {
    caption: `of ${formatUSDCompact(m.budgeted)} budgeted`,
    tone: 'positive',
    iconTone: 'emerald'
  }
}

function incomeVsPlanView(m: PlanSummaryMetrics): SpendVsBudgetTone {
  if (m.plannedIncome <= 0) {
    return { caption: 'no income planned', tone: 'neutral', iconTone: 'gray' }
  }
  const ahead = m.actualIncome - m.plannedIncome
  if (ahead > 0) {
    return {
      caption: `+${formatUSDCompact(ahead)} ahead`,
      tone: 'positive',
      iconTone: 'emerald'
    }
  }
  if (ahead === 0) {
    return {
      caption: `of ${formatUSDCompact(m.plannedIncome)} planned`,
      tone: 'neutral',
      iconTone: 'emerald'
    }
  }
  return {
    caption: `of ${formatUSDCompact(m.plannedIncome)} planned`,
    tone: 'negative',
    iconTone: 'red'
  }
}

function savingsView(m: PlanSummaryMetrics): SpendVsBudgetTone {
  const iconTone: IconTone = m.actualSavings >= 0 ? 'emerald' : 'red'
  if (m.plannedSavings <= 0) {
    const tone: CaptionTone =
      m.actualSavings > 0 ? 'positive' : m.actualSavings < 0 ? 'negative' : 'neutral'
    return { caption: 'actual surplus', tone, iconTone }
  }
  const delta = m.savingsDelta
  const direction = delta >= 0 ? 'ahead' : 'behind'
  const caption = `planned ${formatUSDCompact(m.plannedSavings)} · ${direction} ${formatUSDCompact(Math.abs(delta))}`
  let tone: CaptionTone
  if (m.actualSavings < 0) {
    tone = 'negative'
  } else if (delta > 0) {
    tone = 'positive'
  } else {
    tone = 'neutral'
  }
  return { caption, tone, iconTone }
}

export interface PlanSummaryTilesProps {
  metrics: PlanSummaryMetrics
}

export function PlanSummaryTiles({ metrics }: PlanSummaryTilesProps) {
  const spend = spendVsBudgetView(metrics)
  const income = incomeVsPlanView(metrics)
  const savings = savingsView(metrics)
  const overCaption =
    metrics.overCount === 0
      ? 'none over budget'
      : `over by ${formatUSDCompact(metrics.totalOverage)}`
  const overTone: CaptionTone = metrics.overCount === 0 ? 'positive' : 'negative'
  const underCaption =
    metrics.underCount === 0
      ? 'none with budget left'
      : `${formatUSDCompact(metrics.totalRemaining)} remaining`
  const underTone: CaptionTone = metrics.underCount === 0 ? 'neutral' : 'positive'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      <KpiTile
        label="Spend vs Budget"
        value={formatUSDCompact(metrics.actualSpend)}
        caption={spend.caption}
        captionTone={spend.tone}
        icon={Wallet}
        iconTone={spend.iconTone}
      />
      <KpiTile
        label="Income vs Plan"
        value={formatUSDCompact(metrics.actualIncome)}
        caption={income.caption}
        captionTone={income.tone}
        icon={TrendingUp}
        iconTone="emerald"
      />
      <KpiTile
        label="Categories Over"
        value={String(metrics.overCount)}
        caption={overCaption}
        captionTone={overTone}
        icon={AlertTriangle}
        iconTone="red"
      />
      <KpiTile
        label="Categories Under"
        value={String(metrics.underCount)}
        caption={underCaption}
        captionTone={underTone}
        icon={PiggyBank}
        iconTone="emerald"
      />
      <KpiTile
        label="Savings"
        value={formatUSDSigned(metrics.actualSavings)}
        caption={savings.caption}
        captionTone={savings.tone}
        icon={PiggyBank}
        iconTone={savings.iconTone}
      />
    </div>
  )
}

export function PlanSummary({ period }: PlanSummaryProps) {
  const budgetsQ = useBudgets(period)
  const range = periodToRange(period)
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const incomeQ = useIncomePlan({ year: period.year })

  const budgetRows = useMemo(
    () =>
      deriveBudgetVsActual({
        budgets: budgetsQ.data ?? [],
        transactions: txsQ.data ?? [],
        period
      }),
    [budgetsQ.data, txsQ.data, period]
  )

  const monthPlans = (incomeQ.data ?? []).filter(p => p.month === period.month)
  const matchResults = useMemo(
    () =>
      matchIncome(
        monthPlans as unknown as Parameters<typeof matchIncome>[0],
        (txsQ.data ?? []) as unknown as Parameters<typeof matchIncome>[1],
        { year: period.year, months: [period.month] }
      ),
    [monthPlans, txsQ.data, period]
  )

  const plannedIncome = monthPlans.reduce((s, p) => s + p.expected_amount, 0)
  const actualIncome = matchResults.reduce((s, r) => s + r.actual, 0)

  const metrics = useMemo(
    () => computePlanSummaryMetrics({ budgetRows, actualIncome, plannedIncome }),
    [budgetRows, actualIncome, plannedIncome]
  )

  return <PlanSummaryTiles metrics={metrics} />
}
