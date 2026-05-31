'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, ArrowRight, X } from 'lucide-react'
import { useBills, useUpdateBill, type BillRow } from '@/lib/data/bills'
import { useBudgets, useCreateBudget } from '@/lib/data/budgets'
import { useCategories, type CategoryRow } from '@/lib/data/categories'
import { findOrphanBills, type OrphanBill } from '@/lib/plan/orphanBills'
import { periodLabel, type PlanPeriod } from '@/lib/plan/period'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { cn } from '@/lib/cn'

export interface OrphanBillsCardProps {
  period: PlanPeriod
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

interface OrphanRowProps {
  orphan: OrphanBill
  categories: ReadonlyArray<CategoryRow>
  period: PlanPeriod
  onAddToPlan: (orphan: OrphanBill) => void
  onRemap: (billId: string, nextCategoryId: string) => void
  isPending: boolean
}

function OrphanRow({ orphan, categories, period, onAddToPlan, onRemap, isPending }: OrphanRowProps) {
  const [picking, setPicking] = useState(false)
  const { bill, category } = orphan

  // Group categories by expense/income for the picker — mirrors Admin/bills pattern.
  const expenseCats = categories.filter(c => c.type === 'expense')
  const incomeCats = categories.filter(c => c.type === 'income')

  return (
    <li className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate" title={bill.name}>
          {bill.name}
        </div>
        <div className="text-xs text-amber-700/80 tabular truncate">
          {formatUSD(bill.budget_amount)}/mo
          <span className="text-amber-700/60 mx-1.5" aria-hidden="true">·</span>
          <ArrowRight size={10} className="inline -mt-0.5 mr-0.5" aria-hidden="true" />
          {category.name}
        </div>
      </div>

      {picking ? (
        <div className="flex items-center gap-2 sm:w-auto w-full">
          <select
            aria-label={`Remap ${bill.name} to a different category`}
            defaultValue={bill.budget_category_id ?? ''}
            disabled={isPending}
            onChange={(e) => {
              const v = e.target.value
              if (v && v !== bill.budget_category_id) {
                onRemap(bill.id, v)
                setPicking(false)
              }
            }}
            className="flex-1 sm:flex-none rounded-md border border-amber-300 bg-surface px-2 py-1 text-xs text-ink disabled:opacity-60"
          >
            <option value="" disabled>Pick category…</option>
            {expenseCats.length > 0 && (
              <optgroup label="Expense">
                {expenseCats.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
            {incomeCats.length > 0 && (
              <optgroup label="Income">
                {incomeCats.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            onClick={() => setPicking(false)}
            aria-label="Cancel remap"
            className="p-1 text-amber-700 hover:text-amber-900 rounded"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onAddToPlan(orphan)}
            disabled={isPending}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium',
              'bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60'
            )}
          >
            <Plus size={12} aria-hidden="true" />
            Add to plan
          </button>
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={isPending}
            className={cn(
              'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium',
              'border border-amber-300 bg-surface text-amber-800 hover:bg-amber-50 disabled:opacity-60'
            )}
            aria-label={`Remap ${bill.name}`}
            data-period-year={period.year}
            data-period-month={period.month}
          >
            Remap
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * Lists bills whose mapped budget_category_id has no budget row in the
 * selected period. Hidden entirely when no orphans exist.
 *
 * Two actions per row:
 *   - "Add to plan": create a budget row at the bill's monthly amount via
 *     useCreateBudget, which removes the bill from the orphan list on success.
 *   - "Remap": change the bill's budget_category_id via useUpdateBill.
 */
export function OrphanBillsCard({ period }: OrphanBillsCardProps) {
  const billsQ = useBills()
  const budgetsQ = useBudgets(period)
  const categoriesQ = useCategories()
  const createBudget = useCreateBudget()
  const updateBill = useUpdateBill()

  const orphans = useMemo(
    () =>
      findOrphanBills({
        bills: billsQ.data ?? [],
        budgets: budgetsQ.data ?? [],
        categories: categoriesQ.data ?? [],
        period
      }),
    [billsQ.data, budgetsQ.data, categoriesQ.data, period]
  )

  if (orphans.length === 0) return null

  const totalMonthly = orphans.reduce((s, o) => s + o.bill.budget_amount, 0)
  const isPending = createBudget.isPending || updateBill.isPending

  function handleAddToPlan(orphan: OrphanBill): void {
    const { bill, category } = orphan
    createBudget.mutate({
      household_id: LOPEZ_HOUSEHOLD_ID,
      year: period.year,
      month: period.month,
      category: category.name,
      category_id: category.id,
      amount: bill.budget_amount
    })
  }

  function handleRemap(billId: string, nextCategoryId: string): void {
    updateBill.mutate({ id: billId, patch: { budget_category_id: nextCategoryId } })
  }

  return (
    <section
      aria-labelledby="orphan-bills-heading"
      className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm overflow-hidden"
    >
      <header className="px-4 sm:px-5 py-3.5 border-b border-amber-200/70 flex items-start gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-100 text-amber-700 shrink-0">
          <AlertTriangle size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 id="orphan-bills-heading" className="text-sm font-semibold text-amber-900">
            Bills not yet in your budget
          </h2>
          <p className="text-xs text-amber-700 mt-0.5">
            {orphans.length} bill{orphans.length === 1 ? '' : 's'} mapped to categories without a budget row for {periodLabel(period)}.{' '}
            <span className="font-medium">{formatUSD(totalMonthly)}/mo total.</span>
          </p>
        </div>
      </header>

      <ul className="divide-y divide-amber-200/60">
        {orphans.map(orphan => (
          <OrphanRow
            key={orphan.bill.id}
            orphan={orphan}
            categories={categoriesQ.data ?? []}
            period={period}
            onAddToPlan={handleAddToPlan}
            onRemap={handleRemap}
            isPending={isPending}
          />
        ))}
      </ul>
    </section>
  )
}
