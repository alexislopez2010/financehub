'use client'

import { Trash2 } from 'lucide-react'
import { EditableCell } from '@/components/ledger/EditableCell'
import type { BudgetVsActualRow } from '@/lib/plan/budgetVsActual'
import { cn } from '@/lib/cn'

export interface BudgetRowProps {
  row: BudgetVsActualRow
  onEditBudget: (next: number) => void
  onDelete: () => void
  onCreateForUnbudgeted: () => void  // for budgetId=null rows: prompt to create a budget
}

/**
 * Shared grid template for the row + the column header in BudgetSection.
 * Keep these in sync — the columns are: Category | Budgeted | Bills | Actual | Remaining | gutter.
 * Bills column hides on small screens to avoid cramping; a mobile-only
 * subline beneath the category surfaces the same number.
 */
export const BUDGET_ROW_GRID =
  'grid grid-cols-[1fr_100px_100px_120px_28px] sm:grid-cols-[1fr_120px_120px_140px_28px] md:grid-cols-[1fr_120px_100px_120px_140px_28px] lg:grid-cols-[1fr_140px_120px_140px_160px_28px] gap-3 items-center'

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function pctOfBudget(actual: number, budgeted: number): number {
  if (budgeted === 0) return 0
  return (actual / budgeted) * 100
}

export function BudgetRow({ row, onEditBudget, onDelete, onCreateForUnbudgeted }: BudgetRowProps) {
  // Truly unbudgeted: no budget rows at all for this category in the period
  // (actuals-only row). Aggregated rows have budgetId=null too but budgeted>0.
  const isUnbudgeted = row.budgetId === null && row.budgeted === 0
  // Aggregated rows: multiple budget rows summed into one display row.
  // We render the full row but suppress per-row edit/delete to avoid
  // mutating only one of several underlying rows.
  const isAggregated = row.budgetId === null && row.budgeted > 0
  const overBudget = !isUnbudgeted && row.variance < 0
  const pct = pctOfBudget(row.actual, row.budgeted)
  const barPct = Math.min(100, Math.max(0, pct))
  const hasBills = row.billsCommitted > 0

  return (
    <div className={cn(
      BUDGET_ROW_GRID,
      'px-4 py-3 text-sm transition-colors hover:bg-gray-50'
    )}>
      <div className="min-w-0">
        <div className="text-ink font-medium truncate">{row.category}</div>
        {!isUnbudgeted && (
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', overBudget ? 'bg-red-500' : 'bg-emerald-500')}
              style={{ width: `${barPct}%` }}
            />
          </div>
        )}
        {isUnbudgeted && (
          <button
            type="button"
            onClick={onCreateForUnbudgeted}
            className="mt-1 text-xs text-brand hover:underline"
          >
            + Add a budget for this
          </button>
        )}
        {/* Mobile-only bills subline: surfaces the Bills column data when it's hidden. */}
        {hasBills && (
          <div
            className={cn(
              'mt-0.5 text-[11px] italic md:hidden',
              row.billsOverCommitted ? 'text-red-600' : 'text-muted'
            )}
          >
            bills: {formatUSD(row.billsCommitted)}
            {row.billsOverCommitted ? ' (over)' : ''}
          </div>
        )}
      </div>

      <div className="text-right tabular text-sm">
        {isUnbudgeted ? (
          <span className="text-muted italic text-xs">no budget</span>
        ) : isAggregated ? (
          <span className="text-ink font-medium">{formatUSD(row.budgeted)}</span>
        ) : (
          <EditableCell
            variant="number"
            value={row.budgeted}
            onCommit={onEditBudget}
            display={<span className="text-ink font-medium">{formatUSD(row.budgeted)}</span>}
            inputClassName="text-right"
          />
        )}
      </div>

      {/* Bills column — hidden on small screens, surfaces in mobile subline above. */}
      <div
        className={cn(
          'hidden md:flex items-center justify-end gap-1.5 text-right tabular text-sm',
          row.billsOverCommitted ? 'text-red-600 font-semibold' : 'text-ink'
        )}
        title={row.billsOverCommitted ? 'Bills exceed this budget' : undefined}
      >
        {hasBills ? (
          <>
            <span>{formatUSD(row.billsCommitted)}</span>
            {row.billsOverCommitted && (
              <span
                aria-label="Bills exceed this budget"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-700 text-[10px] font-bold leading-none"
              >
                !
              </span>
            )}
          </>
        ) : (
          <span className="text-muted">—</span>
        )}
      </div>

      <div className="text-right tabular text-sm text-ink font-medium">
        {formatUSD(row.actual)}
      </div>

      <div className={cn(
        'text-right tabular text-sm font-semibold',
        row.variance < 0 ? 'text-red-600' : row.variance > 0 ? 'text-emerald-600' : 'text-muted'
      )}>
        {row.variance < 0 ? '−' : row.variance > 0 ? '+' : ''}
        {formatUSD(Math.abs(row.variance))}
      </div>

      <div className="text-right">
        {!isUnbudgeted && !isAggregated && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete budget for ${row.category}`}
            className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
