'use client'

import { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useBills, useUpdateBill } from '@/lib/data/bills'
import { useCategories, useUpdateCategory } from '@/lib/data/categories'
import { useTransactions } from '@/lib/data/transactions'
import { buildProjectInputs } from '@/lib/forecast/buildProjectInputs'
import { project, projectDiscretionary, type BillProjection, type StatTxn } from '@/lib/forecast/project'
import { rollupByTier } from '@/lib/forecast/rollupByTier'
import { TIER_ORDER } from '@/lib/forecast/tierTheme'
import type { SpendTier } from '@/lib/forecast/tier'
import { ForecastTierChart, type ForecastMonthBar } from './ForecastTierChart'
import { TierGroup } from './TierGroup'
import { ProposeBudgetsPanel } from './ProposeBudgetsPanel'

const HORIZONS = [6, 12, 24] as const
type Horizon = (typeof HORIZONS)[number]

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

/** Aligns the per-tier rollup into one bar per projected month for the chart. */
function toChartData(
  essential: ReadonlyArray<{ year: number; month: number; amount: number }>,
  services: ReadonlyArray<{ year: number; month: number; amount: number }>,
  discretionary: ReadonlyArray<{ year: number; month: number; amount: number }>
): ForecastMonthBar[] {
  const key = (y: number, m: number) => y * 12 + (m - 1)
  const byKey = new Map<number, ForecastMonthBar>()
  const ensure = (y: number, m: number) => {
    const k = key(y, m)
    let bar = byKey.get(k)
    if (!bar) { bar = { year: y, month: m, essential: 0, services: 0, discretionary: 0 }; byKey.set(k, bar) }
    return bar
  }
  for (const c of essential) ensure(c.year, c.month).essential += c.amount
  for (const c of services) ensure(c.year, c.month).services += c.amount
  for (const c of discretionary) ensure(c.year, c.month).discretionary += c.amount
  return [...byKey.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

export function ForecastSection() {
  const billsQuery = useBills()
  const categoriesQuery = useCategories()
  const txQuery = useTransactions()
  const updateBill = useUpdateBill()
  const updateCategory = useUpdateCategory()
  const [horizon, setHorizon] = useState<Horizon>(12)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const bills = billsQuery.data
  const categories = categoriesQuery.data
  const transactions = txQuery.data

  // First projected month = current month (forecast the rest of this month forward).
  const now = new Date()
  const startYear = now.getFullYear()
  const startMonth = now.getMonth() + 1

  const statTxns = useMemo<ReadonlyArray<StatTxn>>(
    () => (transactions ?? []).map(t => ({ date: t.date, amount: t.amount, type: t.type, category: t.category })),
    [transactions]
  )

  const inputs = useMemo(
    () => buildProjectInputs({ bills: bills ?? [], categories: categories ?? [] }),
    [bills, categories]
  )

  const allProjections = useMemo<ReadonlyArray<BillProjection>>(() => {
    const billProj = project({ bills: inputs.bills, transactions: statTxns, horizon, startYear, startMonth })
    const discProj = projectDiscretionary({ categories: inputs.discretionaryCategories, transactions: statTxns, horizon, startYear, startMonth })
    return [...billProj, ...discProj]
  }, [inputs, statTxns, horizon, startYear, startMonth])

  const rollup = useMemo(() => rollupByTier(allProjections), [allProjections])
  const chartData = useMemo(
    () => toChartData(rollup.essential, rollup.services, rollup.discretionary),
    [rollup]
  )

  const categoryIdByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categories ?? []) map.set(c.name.trim().toLowerCase(), c.id)
    return map
  }, [categories])

  const projectionsByTier = useMemo(() => {
    const groups: Record<SpendTier, BillProjection[]> = { essential: [], services: [], discretionary: [] }
    for (const p of allProjections) groups[p.tier].push(p)
    return groups
  }, [allProjections])

  // First-month total across all tiers — the headline number.
  const firstMonthTotal = chartData[0]
    ? chartData[0].essential + chartData[0].services + chartData[0].discretionary
    : 0

  async function handleChangeTier(p: BillProjection, tier: SpendTier) {
    setPendingId(p.billId)
    try {
      if (p.billId.startsWith('cat:')) {
        // Discretionary category line — persist the override on the category.
        const id = categoryIdByName.get((p.category ?? '').trim().toLowerCase())
        if (id) await updateCategory.mutateAsync({ id, patch: { tier } })
      } else {
        await updateBill.mutateAsync({ id: p.billId, patch: { tier } })
      }
    } finally {
      setPendingId(null)
    }
  }

  if (billsQuery.isLoading || categoriesQuery.isLoading || txQuery.isLoading) {
    return <p className="text-sm text-muted">Loading forecast…</p>
  }
  if (billsQuery.isError || categoriesQuery.isError || txQuery.isError) {
    return <p className="text-sm text-warn">Couldn’t load forecast data.</p>
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-muted">
            <TrendingUp className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Forecast</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">
            {fmtUSD(firstMonthTotal)}<span className="text-base font-normal text-muted"> projected this month</span>
          </h1>
        </div>

        <div className="inline-flex rounded-lg border border-rule bg-surface p-0.5" role="group" aria-label="Forecast horizon">
          {HORIZONS.map(h => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              aria-pressed={horizon === h}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                horizon === h ? 'bg-brand text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {h}mo
            </button>
          ))}
        </div>
      </header>

      <section className="rounded-xl border border-rule bg-surface p-4">
        <ForecastTierChart data={chartData} />
      </section>

      <div className="space-y-3">
        {TIER_ORDER.map(tier => (
          <TierGroup
            key={tier}
            tier={tier}
            projections={projectionsByTier[tier]}
            focusYear={startYear}
            focusMonth={startMonth}
            onChangeTier={handleChangeTier}
            pendingId={pendingId}
          />
        ))}
      </div>

      <ProposeBudgetsPanel
        projections={allProjections}
        targetYear={startYear}
        targetMonth={startMonth}
        categoryIdByName={categoryIdByName}
      />
    </div>
  )
}
