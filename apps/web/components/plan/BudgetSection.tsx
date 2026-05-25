'use client'

import { useState, useMemo } from 'react'
import { Wallet, Plus } from 'lucide-react'
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget } from '@/lib/data/budgets'
import { useTransactions } from '@/lib/data/transactions'
import { useCategories } from '@/lib/data/categories'
import { deriveBudgetVsActual } from '@/lib/plan/budgetVsActual'
import { periodToRange, type PlanPeriod } from '@/lib/plan/period'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { BudgetRow } from './BudgetRow'
import { AddBudgetForm } from './AddBudgetForm'
import { cn } from '@/lib/cn'

export interface BudgetSectionProps {
  period: PlanPeriod
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function BudgetSection({ period }: BudgetSectionProps) {
  const budgetsQ = useBudgets(period)
  const range = periodToRange(period)
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const categoriesQ = useCategories()
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()

  const [showAddForm, setShowAddForm] = useState(false)
  const [preselected, setPreselected] = useState<{ id: string | null; name: string } | null>(null)

  const rows = useMemo(
    () => deriveBudgetVsActual({
      budgets: budgetsQ.data ?? [],
      transactions: txsQ.data ?? [],
      period
    }),
    [budgetsQ.data, txsQ.data, period]
  )

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  const remaining = totalBudgeted - totalActual

  // Categories not yet used by a budget for this period.
  const budgetedNames = new Set(
    (budgetsQ.data ?? []).map(b => (b.category ?? '').toLowerCase())
  )
  const availableCategories = (categoriesQ.data ?? []).filter(
    c => c.type === 'expense' && !budgetedNames.has(c.name.toLowerCase())
  )

  function handleCreate(input: { category: string; categoryId: string | null; amount: number }) {
    createBudget.mutate({
      household_id: LOPEZ_HOUSEHOLD_ID,
      year: period.year,
      month: period.month,
      category: input.category,
      category_id: input.categoryId,
      amount: input.amount
    })
    setShowAddForm(false)
    setPreselected(null)
  }

  function handleEditBudget(budgetId: string, next: number) {
    updateBudget.mutate({ id: budgetId, patch: { amount: next } })
  }

  function handleDelete(budgetId: string) {
    deleteBudget.mutate(budgetId)
  }

  function handleCreateForUnbudgeted(category: string, categoryId: string | null) {
    setPreselected({ id: categoryId, name: category })
    setShowAddForm(true)
  }

  const isLoading = budgetsQ.isLoading || txsQ.isLoading
  const error = budgetsQ.error || txsQ.error

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <header className="px-4 sm:px-5 py-4 flex items-baseline justify-between gap-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600">
            <Wallet size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Expense Budget</h2>
            <p className="text-xs text-muted">vs actual spending</p>
          </div>
        </div>
        <div className="text-right text-sm tabular">
          <div className="text-ink font-medium">
            <span className="text-emerald-600">{formatUSD(totalActual)}</span>
            <span className="text-muted"> / </span>
            <span>{formatUSD(totalBudgeted)}</span>
          </div>
          <div className={cn('text-xs', remaining < 0 ? 'text-red-600' : 'text-muted')}>
            {remaining < 0 ? `over by ${formatUSD(Math.abs(remaining))}` : `${formatUSD(remaining)} left`}
          </div>
        </div>
      </header>

      {/* Column labels */}
      <div className="grid grid-cols-[1fr_100px_100px_120px_28px] sm:grid-cols-[1fr_120px_120px_140px_28px] gap-3 px-4 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted bg-gray-50 border-b border-rule">
        <div>Category</div>
        <div className="text-right">Budgeted</div>
        <div className="text-right">Actual</div>
        <div className="text-right">Remaining</div>
        <div></div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
      ) : error ? (
        <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
          Failed to load: {error.message}
        </div>
      ) : rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted">
          No budget rows or spending in this period.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {rows.map(r => (
            <li key={r.budgetId ?? `unbudgeted:${r.category}`} className="group">
              <BudgetRow
                row={r}
                onEditBudget={(next) => r.budgetId && handleEditBudget(r.budgetId, next)}
                onDelete={() => r.budgetId && handleDelete(r.budgetId)}
                onCreateForUnbudgeted={() => handleCreateForUnbudgeted(r.category, r.categoryId)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Add row */}
      {showAddForm ? (
        <AddBudgetForm
          availableCategories={availableCategories}
          {...(preselected?.id !== undefined ? { initialCategoryId: preselected.id } : {})}
          {...(preselected?.name !== undefined ? { initialCategoryName: preselected.name } : {})}
          isSubmitting={createBudget.isPending}
          onSubmit={handleCreate}
          onCancel={() => { setShowAddForm(false); setPreselected(null) }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full px-4 py-2.5 text-sm text-brand hover:bg-blue-50 border-t border-rule flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus size={14} />
          Add a budget category
        </button>
      )}
    </section>
  )
}
