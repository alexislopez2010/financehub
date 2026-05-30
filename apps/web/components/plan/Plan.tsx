'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { currentPeriod, parsePeriod, periodToRange, type PlanPeriod } from '@/lib/plan/period'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { useTransactions } from '@/lib/data/transactions'
import { computePlanIncome } from '@/lib/plan/income'
import { PeriodSelector } from './PeriodSelector'
import { PlanSummary } from './PlanSummary'
import { BudgetSection } from './BudgetSection'
import { IncomeSection } from './IncomeSection'

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

  // Income computation is lifted here so PlanSummary and BudgetSection
  // share the same planned/actual numbers without each one re-running
  // matchIncome. TanStack Query caches by key, so this hook + the
  // transactions hook are deduped with the same calls inside the child
  // surfaces (IncomeSection still drives its own row-level matching).
  const range = periodToRange(period)
  const incomeQ = useIncomePlan({ year: period.year })
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const { plannedIncome, actualIncome } = useMemo(
    () => computePlanIncome({
      plans: incomeQ.data ?? [],
      transactions: txsQ.data ?? [],
      period
    }),
    [incomeQ.data, txsQ.data, period]
  )

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Plan</h1>
          <p className="text-sm text-muted">Budget &amp; income for the selected month.</p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </header>

      <PlanSummary period={period} plannedIncome={plannedIncome} actualIncome={actualIncome} />
      <BudgetSection
        period={period}
        plannedIncome={plannedIncome}
        actualIncome={actualIncome}
      />
      <IncomeSection period={period} />
    </div>
  )
}
