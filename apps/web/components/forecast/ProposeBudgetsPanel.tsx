'use client'

import { useMemo, useState } from 'react'
import { useBudgets } from '@/lib/data/budgets'
import { useApplyBudgets, type BudgetInsert } from '@/lib/data/forecastMutations'
import { proposeBudgets, type CurrentBudget } from '@/lib/forecast/proposeBudgets'
import type { BillProjection } from '@/lib/forecast/project'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export interface ProposeBudgetsPanelProps {
  projections: ReadonlyArray<BillProjection>
  targetYear: number
  targetMonth: number
  /** Resolve a category name to its categories.id so inserts keep the FK. */
  categoryIdByName: ReadonlyMap<string, string>
}

/**
 * Proposes per-category budgets for the target month from the projections and
 * lets the user apply them with one click — nothing is written until they do.
 * Each row defaults to selected only when the projection differs from the
 * current budget, so "Apply" never silently rewrites unchanged categories.
 */
export function ProposeBudgetsPanel({ projections, targetYear, targetMonth, categoryIdByName }: ProposeBudgetsPanelProps) {
  const budgetsQuery = useBudgets({ year: targetYear, month: targetMonth })
  const apply = useApplyBudgets()
  const budgetRows = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data])

  // First budget row per category — the slot Apply updates. Prod budgets are
  // de-duped to one row per category/period, so extras shouldn't exist.
  const budgetRowByCategory = useMemo(() => {
    const map = new Map<string, { id: string }>()
    for (const r of budgetRows) {
      if (r.category && !map.has(r.category)) map.set(r.category, { id: r.id })
    }
    return map
  }, [budgetRows])

  const currentBudgets = useMemo<ReadonlyArray<CurrentBudget>>(
    () => budgetRows
      .filter((r): r is typeof r & { category: string } => r.category != null)
      .map(r => ({ category: r.category, amount: r.amount ?? 0 })),
    [budgetRows]
  )

  const proposals = useMemo(
    () => proposeBudgets({ projections, currentBudgets, targetYear, targetMonth }),
    [projections, currentBudgets, targetYear, targetMonth]
  )

  const changed = useMemo(() => proposals.filter(p => Math.abs(p.delta) >= 0.01), [proposals])
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null)
  // Default selection = all changed categories (computed lazily, recomputed when
  // the changed set identity shifts via the key below).
  const effectiveSelected = selected ?? new Set(changed.map(p => p.category))

  function toggle(category: string) {
    const next = new Set(effectiveSelected)
    if (next.has(category)) next.delete(category)
    else next.add(category)
    setSelected(next)
  }

  async function handleApply() {
    const picked = proposals.filter(p => effectiveSelected.has(p.category))
    const updates: { id: string; amount: number }[] = []
    const inserts: BudgetInsert[] = []
    for (const p of picked) {
      const existing = budgetRowByCategory.get(p.category)
      if (existing) {
        updates.push({ id: existing.id, amount: p.proposed })
      } else {
        const categoryId = categoryIdByName.get(p.category.trim().toLowerCase())
        inserts.push({
          household_id: LOPEZ_HOUSEHOLD_ID,
          category: p.category,
          ...(categoryId ? { category_id: categoryId } : {}),
          year: targetYear,
          month: targetMonth,
          amount: p.proposed
        })
      }
    }
    try {
      await apply.mutateAsync({ year: targetYear, month: targetMonth, updates, inserts })
      // Reset to the default selection; after the refetch, applied rows have a
      // zero delta and drop out of `changed`, so nothing stays auto-selected.
      setSelected(null)
    } catch {
      // apply.isError surfaces the message below — no extra handling needed.
    }
  }

  if (budgetsQuery.isLoading) {
    return <p className="text-sm text-muted">Loading current budgets…</p>
  }

  const pickedCount = proposals.filter(p => effectiveSelected.has(p.category)).length

  return (
    <div className="rounded-xl border border-rule bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Propose budgets</h3>
          <p className="text-xs text-muted">
            For {MONTHS[targetMonth - 1]} {targetYear} · {changed.length} {changed.length === 1 ? 'change' : 'changes'} suggested
          </p>
        </div>
        <button
          type="button"
          onClick={handleApply}
          // Block applies while a refetch is in flight so the update/insert split
          // is never computed from stale budget rows (avoids duplicate inserts).
          disabled={pickedCount === 0 || apply.isPending || budgetsQuery.isFetching}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {apply.isPending ? 'Applying…' : `Apply ${pickedCount} ${pickedCount === 1 ? 'change' : 'changes'}`}
        </button>
      </div>

      {apply.isError && (
        <p className="px-4 py-2 text-xs text-warn">Couldn’t apply: {apply.error.message}</p>
      )}
      {apply.isSuccess && !apply.isPending && (
        <p className="px-4 py-2 text-xs text-accent">Budgets updated.</p>
      )}

      {proposals.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">No projected categories to budget yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2 font-medium"> </th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">Current</th>
                <th className="px-4 py-2 text-right font-medium">Proposed</th>
                <th className="px-4 py-2 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => {
                const isChange = Math.abs(p.delta) >= 0.01
                const deltaTone = p.delta > 0 ? 'text-warn' : p.delta < 0 ? 'text-accent' : 'text-muted'
                return (
                  <tr key={p.category} className="border-t border-rule">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Apply ${p.category}`}
                        checked={effectiveSelected.has(p.category)}
                        onChange={() => toggle(p.category)}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                    </td>
                    <td className="px-4 py-2 text-ink">{p.category}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">{fmtUSD(p.current)}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-ink">{fmtUSD(p.proposed)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${deltaTone}`}>
                      {isChange ? `${p.delta > 0 ? '+' : ''}${fmtUSD(p.delta)}` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
