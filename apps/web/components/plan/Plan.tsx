'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { currentPeriod, parsePeriod, type PlanPeriod } from '@/lib/plan/period'
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

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Plan</h1>
          <p className="text-sm text-muted">Budget &amp; income for the selected month.</p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </header>

      <PlanSummary period={period} />
      <BudgetSection period={period} />
      <IncomeSection period={period} />
    </div>
  )
}
