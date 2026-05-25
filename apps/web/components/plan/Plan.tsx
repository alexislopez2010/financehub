'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBudgets } from '@/lib/data/budgets'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { useTransactions } from '@/lib/data/transactions'
import { currentPeriod, parsePeriod, periodToRange, type PlanPeriod } from '@/lib/plan/period'
import { PeriodSelector } from './PeriodSelector'

export function Plan() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = parsePeriod(
    searchParams?.get('year') ?? null,
    searchParams?.get('month') ?? null,
    currentPeriod()
  )

  const [period, setPeriod] = useState<PlanPeriod>(initial)

  useEffect(() => {
    const url = `/plan?year=${period.year}&month=${period.month}`
    router.replace(url, { scroll: false })
  }, [period, router])

  const budgetsQ = useBudgets(period)
  const incomeQ = useIncomePlan({ year: period.year })
  const range = periodToRange(period)
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })

  const monthIncomePlans = (incomeQ.data ?? []).filter(p => p.month === period.month)

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Plan</h1>
          <p className="text-sm text-muted">Budget &amp; income for the selected month.</p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </header>

      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        {budgetsQ.isLoading || incomeQ.isLoading || txsQ.isLoading
          ? 'Loading…'
          : `Showing ${budgetsQ.data?.length ?? 0} budget rows, ${monthIncomePlans.length} income plan rows, ${txsQ.data?.length ?? 0} transactions for the selected period. Budget + income sections land in 2H.T2 / T3.`}
      </div>
    </div>
  )
}
