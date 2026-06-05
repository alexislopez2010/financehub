'use client'

import { useState, useMemo } from 'react'
import { Wallet, Plus, AlertTriangle } from 'lucide-react'
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget } from '@/lib/data/budgets'
import { useTransactions, useUpdateTransaction } from '@/lib/data/transactions'
import { useCategories } from '@/lib/data/categories'
import { useBills } from '@/lib/data/bills'
import { deriveBudgetVsActual } from '@/lib/plan/budgetVsActual'
import { periodToRange, type PlanPeriod } from '@/lib/plan/period'
import {
  computeOverBudgetReconciliation,
  type ReconciliationTone
} from '@/lib/plan/reconcile'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import type { BudgetVsActualRow } from '@/lib/plan/budgetVsActual'
import { transactionsForBudgetRow } from '@/lib/plan/budgetRowTransactions'
import { billsForCategory } from '@/lib/plan/billsForCategory'
import type { TransactionRow as FinanceTransactionRow } from '@/lib/finance/types'
import { BudgetRow, BUDGET_ROW_GRID } from './BudgetRow'
import { BudgetRowDrawer } from './BudgetRowDrawer'
import { BudgetRowBillsDrawer } from './BudgetRowBillsDrawer'
import { AddBudgetForm } from './AddBudgetForm'
import { cn } from '@/lib/cn'

const MONTH_NAMES: ReadonlyArray<string> = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function periodLabel(period: PlanPeriod): string {
  const name = period.month >= 1 && period.month <= 12 ? MONTH_NAMES[period.month] : String(period.month)
  return `${name} ${period.year}`
}

export interface BudgetSectionProps {
  period: PlanPeriod
  /**
   * Planned income for the period, lifted from Plan.tsx so the header can
   * reconcile over-budget spend against unplanned income variance. Optional
   * for callers that don't have the data — the reconciliation line simply
   * won't render in that case.
   */
  plannedIncome?: number
  /** Actual income for the period. See `plannedIncome` for rationale. */
  actualIncome?: number
}

const RECONCILIATION_TONE_CLASSES: Record<ReconciliationTone, string> = {
  positive: 'text-emerald-700',
  warning: 'text-amber-600',
  negative: 'text-red-700'
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function BudgetSection({
  period,
  plannedIncome,
  actualIncome
}: BudgetSectionProps) {
  const budgetsQ = useBudgets(period)
  const range = periodToRange(period)
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const categoriesQ = useCategories()
  const billsQ = useBills()
  const createBudget = useCreateBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()
  const updateTx = useUpdateTransaction()

  const [showAddForm, setShowAddForm] = useState(false)
  /**
   * Which row's "Actual" drawer is currently expanded. Lifted here (rather
   * than per-row state) so only one drawer is open at a time, and so the
   * drawer can render BELOW the row in the parent's list. Keyed by the
   * lowercased category name — matches whatever budgetVsActual emits.
   */
  const [expandedActuals, setExpandedActuals] = useState<string | null>(null)
  /**
   * Which row's "Bills" drawer is currently expanded. Same lowercased-key
   * pattern as expandedActuals. Opening the bills drawer auto-closes any
   * open actuals drawer (and vice versa) so the UI never stacks two
   * drawers under one row.
   */
  const [expandedBills, setExpandedBills] = useState<string | null>(null)

  const rows = useMemo(
    () => deriveBudgetVsActual({
      budgets: budgetsQ.data ?? [],
      transactions: txsQ.data ?? [],
      period,
      bills: billsQ.data ?? []
    }),
    [budgetsQ.data, txsQ.data, billsQ.data, period]
  )

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)
  const remaining = totalBudgeted - totalActual
  const overBudgetAmount = Math.max(0, totalActual - totalBudgeted)
  const totalBillsCommitted = rows.reduce((s, r) => s + r.billsCommitted, 0)
  const billsPct =
    totalBudgeted > 0 ? Math.round((totalBillsCommitted / totalBudgeted) * 100) : null
  const billsOverCommitted = totalBudgeted > 0 && totalBillsCommitted > totalBudgeted

  const reconciliation = useMemo(() => {
    if (plannedIncome === undefined || actualIncome === undefined) return null
    return computeOverBudgetReconciliation({
      overBudgetAmount,
      incomeVariance: actualIncome - plannedIncome
    })
  }, [overBudgetAmount, plannedIncome, actualIncome])

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
  }

  function handleEditBudget(budgetId: string, next: number) {
    updateBudget.mutate({ id: budgetId, patch: { amount: next } })
  }

  function handleDelete(budgetId: string) {
    deleteBudget.mutate(budgetId)
  }

  /**
   * Reclassify a single transaction from inside the drawer. Mirrors the
   * Ledger's handleEditCategory: write both `category_id` (FK) and
   * `category` (text) so display layers downstream don't see drift between
   * the two columns. An empty string clears both.
   */
  function handleRecategorize(txId: string, nextCategoryId: string) {
    const cat = (categoriesQ.data ?? []).find(c => c.id === nextCategoryId)
    updateTx.mutate({
      id: txId,
      patch: nextCategoryId === ''
        ? { category_id: null, category: null }
        : { category_id: nextCategoryId, category: cat?.name ?? null }
    })
  }

  // Flat options list for EditableCell's select. Limited to expense
  // categories — the drawer only opens on budget rows (which are expense)
  // and an "(uncategorized)" option is prepended inside the drawer.
  const expenseCategoryOptions = useMemo(
    () =>
      (categoriesQ.data ?? [])
        .filter(c => c.type === 'expense')
        .map(c => ({ value: c.id, label: c.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [categoriesQ.data]
  )

  /**
   * Inline-create for an actuals-only row. Resolves the free-text category
   * name back to a categories row when possible so the FK is set — the
   * unbudgeted-row derivation drops categoryId, so we look it up here.
   */
  function handleCreateBudgetForRow(row: BudgetVsActualRow, amount: number) {
    const matched = (categoriesQ.data ?? []).find(
      c => c.name.trim().toLowerCase() === row.category.trim().toLowerCase()
    )
    createBudget.mutate({
      household_id: LOPEZ_HOUSEHOLD_ID,
      year: period.year,
      month: period.month,
      category: matched?.name ?? row.category,
      category_id: matched?.id ?? null,
      amount
    })
  }

  const isLoading = budgetsQ.isLoading || txsQ.isLoading || billsQ.isLoading
  const error = budgetsQ.error || txsQ.error || billsQ.error

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <header className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-rule">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600">
            <Wallet size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Expense Budget</h2>
            <p className="text-xs text-muted">vs actual spending</p>
          </div>
        </div>
        <div className="text-right text-sm tabular space-y-1">
          <div className="text-ink font-medium">
            <span className="text-emerald-600">{formatUSD(totalActual)}</span>
            <span className="text-muted"> / </span>
            <span>{formatUSD(totalBudgeted)}</span>
          </div>
          <div className={cn('text-xs', remaining < 0 ? 'text-red-600' : 'text-muted')}>
            {remaining < 0 ? `over by ${formatUSD(Math.abs(remaining))}` : `${formatUSD(remaining)} left`}
          </div>
          {reconciliation && (
            <div
              data-testid="over-budget-reconciliation"
              className={cn(
                'text-[11px] pt-0.5',
                RECONCILIATION_TONE_CLASSES[reconciliation.tone]
              )}
            >
              <span aria-hidden="true">{'· '}</span>
              {reconciliation.text}
            </div>
          )}
          {totalBillsCommitted > 0 && (
            <div
              className={cn(
                'text-[11px] flex items-center justify-end gap-1.5 pt-1',
                billsOverCommitted ? 'text-red-700' : 'text-muted'
              )}
            >
              {billsOverCommitted && <AlertTriangle size={12} aria-hidden="true" />}
              <span>
                Bills committed:{' '}
                <span className={cn('font-semibold', billsOverCommitted ? 'text-red-700' : 'text-ink')}>
                  {formatUSD(totalBillsCommitted)}
                </span>
                {totalBudgeted > 0 && (
                  <>
                    {' '}of {formatUSD(totalBudgeted)} budget
                    {billsPct !== null && (
                      <>
                        {' ('}
                        <span className={billsOverCommitted ? 'font-semibold' : ''}>{billsPct}%</span>
                        {')'}
                      </>
                    )}
                  </>
                )}
                {billsOverCommitted && <span className="font-semibold"> · over-committed</span>}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Column labels */}
      <div className={cn(
        BUDGET_ROW_GRID,
        'px-4 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted bg-gray-50 border-b border-rule'
      )}>
        <div>Category</div>
        <div className="text-right">Budgeted</div>
        <div className="hidden md:block text-right">Bills</div>
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
          {rows.map(r => {
            const key = r.category.toLowerCase()
            const isActualsOpen = expandedActuals === key
            const isBillsOpen = expandedBills === key
            return (
              <li key={r.budgetId ?? `unbudgeted:${r.category}`} className="group">
                <BudgetRow
                  row={r}
                  onEditBudget={(next) => r.budgetId && handleEditBudget(r.budgetId, next)}
                  onDelete={() => r.budgetId && handleDelete(r.budgetId)}
                  onCreateBudget={(amount) => handleCreateBudgetForRow(r, amount)}
                  onToggleActuals={() => {
                    setExpandedActuals(prev => (prev === key ? null : key))
                    setExpandedBills(null)
                  }}
                  isActualsOpen={isActualsOpen}
                  onToggleBills={r.billsCommitted > 0 ? () => {
                    setExpandedBills(prev => (prev === key ? null : key))
                    setExpandedActuals(null)
                  } : undefined}
                  isBillsOpen={isBillsOpen}
                />
                {isActualsOpen && (
                  <BudgetRowDrawer
                    category={r.category}
                    totalActual={r.actual}
                    transactions={transactionsForBudgetRow({
                      transactions: (txsQ.data ?? []) as unknown as ReadonlyArray<FinanceTransactionRow>,
                      period,
                      category: r.category
                    })}
                    categoryOptions={expenseCategoryOptions}
                    onUpdateCategory={handleRecategorize}
                    onClose={() => setExpandedActuals(null)}
                  />
                )}
                {isBillsOpen && (
                  <BudgetRowBillsDrawer
                    category={r.category}
                    periodLabel={periodLabel(period)}
                    totalBillsCommitted={r.billsCommitted}
                    bills={billsForCategory({
                      bills: billsQ.data ?? [],
                      categoryId: r.categoryId,
                      period
                    })}
                    onClose={() => setExpandedBills(null)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Add row */}
      {showAddForm ? (
        <AddBudgetForm
          availableCategories={availableCategories}
          isSubmitting={createBudget.isPending}
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
          Add a budget category
        </button>
      )}
    </section>
  )
}
