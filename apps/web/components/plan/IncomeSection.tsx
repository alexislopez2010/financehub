'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, Plus } from 'lucide-react'
import {
  useIncomePlan, useCreateIncomePlan, useUpdateIncomePlan, useDeleteIncomePlan
} from '@/lib/data/incomePlan'
import { useTransactions } from '@/lib/data/transactions'
import { matchIncome } from '@/lib/finance/incomeMatching'
import { periodToRange, type PlanPeriod } from '@/lib/plan/period'
import { IncomeRow } from './IncomeRow'
import { AddIncomeForm } from './AddIncomeForm'
import { cn } from '@/lib/cn'

export interface IncomeSectionProps {
  period: PlanPeriod
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function IncomeSection({ period }: IncomeSectionProps) {
  const incomeQ = useIncomePlan({ year: period.year })
  const range = periodToRange(period)
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const createPlan = useCreateIncomePlan()
  const updatePlan = useUpdateIncomePlan()
  const deletePlan = useDeleteIncomePlan()

  const [showAddForm, setShowAddForm] = useState(false)

  // All plans for the period (filter the year-scoped data to the selected month)
  const monthPlans = useMemo(
    () => (incomeQ.data ?? []).filter(p => p.month === period.month),
    [incomeQ.data, period.month]
  )

  // Match income txs against ALL plans (aggregated by source). matchIncome
  // returns one result per source; we map source → actual for display.
  const matchResults = useMemo(
    () => matchIncome(
      // matchIncome expects IncomePlanRow with optional `cadence`; the generated
      // type uses `frequency`. Cast through unknown — the algorithm only reads
      // source, member, year, month, is_active, expected_amount.
      monthPlans as unknown as Parameters<typeof matchIncome>[0],
      (txsQ.data ?? []) as unknown as Parameters<typeof matchIncome>[1],
      { year: period.year, months: [period.month] }
    ),
    [monthPlans, txsQ.data, period]
  )

  // Build source → matched-actual lookup. Each plan row gets the full
  // source-level actual; we show it on each row of that source. (Sources
  // with multiple members all see the same actual; this is intentional —
  // matching can't tell the members apart from a description match alone.)
  const actualBySource = new Map<string, number>()
  for (const r of matchResults) {
    actualBySource.set(r.source.toLowerCase(), r.actual)
  }
  const uncategorizedResult = matchResults.find(r => r.source === 'Uncategorized')

  const totalPlanned = monthPlans.reduce((s, p) => s + p.expected_amount, 0)
  const totalActualReceived = matchResults.reduce((s, r) => s + r.actual, 0)
  const variance = totalActualReceived - totalPlanned

  function handleCreate(input: {
    source: string; member: string | null; frequency: string; expected_amount: number
  }) {
    createPlan.mutate({
      household_id: (incomeQ.data?.[0]?.household_id) ?? (txsQ.data?.[0]?.household_id) ?? '',
      year: period.year,
      month: period.month,
      source: input.source,
      member: input.member,
      frequency: input.frequency,
      expected_amount: input.expected_amount,
      is_active: true
    })
    setShowAddForm(false)
  }

  function handleEditAmount(id: string, next: number) {
    updatePlan.mutate({ id, patch: { expected_amount: next } })
  }

  function handleDelete(id: string) {
    deletePlan.mutate(id)
  }

  const isLoading = incomeQ.isLoading || txsQ.isLoading
  const error = incomeQ.error || txsQ.error

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <header className="px-4 sm:px-5 py-4 flex items-baseline justify-between gap-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Income Plan</h2>
            <p className="text-xs text-muted">planned vs received</p>
          </div>
        </div>
        <div className="text-right text-sm tabular">
          <div className="text-ink font-medium">
            <span className="text-emerald-600">{formatUSD(totalActualReceived)}</span>
            <span className="text-muted"> / </span>
            <span>{formatUSD(totalPlanned)}</span>
          </div>
          <div className={cn('text-xs', variance < 0 ? 'text-amber-600' : 'text-muted')}>
            {variance >= 0
              ? `${formatUSD(variance)} ahead`
              : `${formatUSD(Math.abs(variance))} short`}
          </div>
        </div>
      </header>

      {/* Column labels */}
      <div className="grid grid-cols-[1fr_100px_100px_120px_28px] sm:grid-cols-[1fr_120px_120px_140px_28px] gap-3 px-4 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted bg-gray-50 border-b border-rule">
        <div>Source</div>
        <div className="text-right">Planned</div>
        <div className="text-right">Received</div>
        <div className="text-right">Variance</div>
        <div></div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
      ) : error ? (
        <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
          Failed to load: {error.message}
        </div>
      ) : monthPlans.length === 0 && !uncategorizedResult ? (
        <div className="px-4 py-8 text-center text-sm text-muted">
          No income planned for this month.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {monthPlans.map(p => (
            <li key={p.id} className="group">
              <IncomeRow
                plan={p}
                matchedActual={actualBySource.get((p.source ?? '').toLowerCase()) ?? 0}
                onEditAmount={(next) => handleEditAmount(p.id, next)}
                onDelete={() => handleDelete(p.id)}
              />
            </li>
          ))}
          {uncategorizedResult && uncategorizedResult.actual > 0 && (
            <li className="px-4 py-3 bg-amber-50/40">
              <div className="flex items-baseline justify-between text-sm">
                <div>
                  <div className="font-medium text-ink">Uncategorized income</div>
                  <div className="text-xs text-muted">
                    {uncategorizedResult.transactions.length} transaction
                    {uncategorizedResult.transactions.length === 1 ? '' : 's'} without a matching plan source
                  </div>
                </div>
                <div className="text-emerald-600 font-semibold tabular">
                  {formatUSD(uncategorizedResult.actual)}
                </div>
              </div>
            </li>
          )}
        </ul>
      )}

      {/* Add row */}
      {showAddForm ? (
        <AddIncomeForm
          isSubmitting={createPlan.isPending}
          onSubmit={handleCreate}
          onCancel={() => setShowAddForm(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full px-4 py-2.5 text-sm text-brand hover:bg-blue-50 border-t border-rule flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus size={14} />
          Add an income source
        </button>
      )}
    </section>
  )
}
