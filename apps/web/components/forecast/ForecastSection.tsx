'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, Sparkles } from 'lucide-react'
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
import { HistoryImportDialog, type BillPick } from './HistoryImportDialog'

const HORIZONS = [6, 12, 24] as const
type Horizon = (typeof HORIZONS)[number]

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

type MonthCell = { year: number; month: number; amount: number }

/**
 * Aligns the per-tier rollup into one bar per projected month for the chart.
 * Accumulates into plain-number tallies (no object mutation), then builds the
 * immutable bar list in a final pure pass.
 */
function toChartData(
  essential: ReadonlyArray<MonthCell>,
  services: ReadonlyArray<MonthCell>,
  discretionary: ReadonlyArray<MonthCell>
): ForecastMonthBar[] {
  const key = (y: number, m: number) => y * 12 + (m - 1)
  const meta = new Map<number, { year: number; month: number }>()
  const tally = new Map<number, { essential: number; services: number; discretionary: number }>()
  const add = (cells: ReadonlyArray<MonthCell>, tier: 'essential' | 'services' | 'discretionary') => {
    for (const c of cells) {
      const k = key(c.year, c.month)
      if (!meta.has(k)) meta.set(k, { year: c.year, month: c.month })
      const t = tally.get(k) ?? { essential: 0, services: 0, discretionary: 0 }
      tally.set(k, { ...t, [tier]: t[tier] + c.amount })
    }
  }
  add(essential, 'essential')
  add(services, 'services')
  add(discretionary, 'discretionary')
  return [...meta.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, m]) => {
      const t = tally.get(k) ?? { essential: 0, services: 0, discretionary: 0 }
      return { year: m.year, month: m.month, essential: t.essential, services: t.services, discretionary: t.discretionary }
    })
}

export function ForecastSection() {
  const billsQuery = useBills()
  const categoriesQuery = useCategories()
  const txQuery = useTransactions()
  const updateBill = useUpdateBill()
  const updateCategory = useUpdateCategory()
  const [horizon, setHorizon] = useState<Horizon>(12)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [tierError, setTierError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

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

  // Real, active bills are the candidates for a seasonal-history import.
  const billPicks = useMemo<BillPick[]>(
    () => (bills ?? []).filter(b => b.is_active !== false).map(b => ({ id: b.id, name: b.name })),
    [bills]
  )

  const projectionsByTier = useMemo<Record<SpendTier, ReadonlyArray<BillProjection>>>(() => {
    const groups: Record<SpendTier, BillProjection[]> = { essential: [], services: [], discretionary: [] }
    for (const p of allProjections) groups[p.tier].push(p)
    return groups
  }, [allProjections])

  // First-month total across all tiers — the headline number.
  const firstMonthTotal = chartData[0]
    ? chartData[0].essential + chartData[0].services + chartData[0].discretionary
    : 0

  async function handleChangeTier(p: BillProjection, tier: SpendTier) {
    setTierError(null)
    // Resolve the write target up front so we never show a spinner for a no-op.
    const isCategoryLine = p.billId.startsWith('cat:')
    const categoryId = isCategoryLine
      ? categoryIdByName.get((p.category ?? '').trim().toLowerCase())
      : undefined
    if (isCategoryLine && !categoryId) {
      setTierError(`Couldn’t save tier for “${p.billName}” — category not found.`)
      return
    }
    setPendingId(p.billId)
    try {
      if (isCategoryLine) {
        await updateCategory.mutateAsync({ id: categoryId!, patch: { tier } })
      } else {
        await updateBill.mutateAsync({ id: p.billId, patch: { tier } })
      }
    } catch (err) {
      setTierError(err instanceof Error ? err.message : 'Couldn’t save the tier change.')
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            disabled={billPicks.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-bg disabled:opacity-40"
          >
            <Sparkles size={14} className="text-brand" />
            <span className="hidden sm:inline">Import history</span>
          </button>

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
        </div>
      </header>

      <section className="rounded-xl border border-rule bg-surface p-4">
        <ForecastTierChart data={chartData} />
      </section>

      {tierError && (
        <p role="alert" className="rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-warn">{tierError}</p>
      )}

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

      <HistoryImportDialog open={importOpen} onOpenChange={setImportOpen} bills={billPicks} />
    </div>
  )
}
