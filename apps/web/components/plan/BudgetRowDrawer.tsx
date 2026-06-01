'use client'

import { X } from 'lucide-react'
import { EditableCell, type SelectOption } from '@/components/ledger/EditableCell'
import type { TransactionRow } from '@/lib/finance/types'
import { cn } from '@/lib/cn'

export interface BudgetRowDrawerProps {
  /** Display name of the category being drilled. Used in the header. */
  category: string
  /** Pre-sorted list of contributing transactions (largest first). */
  transactions: ReadonlyArray<TransactionRow>
  /** Row's actual total — shown in the header and validated to match. */
  totalActual: number
  onClose: () => void
  /**
   * Category options for the per-row category dropdown. Same shape as
   * EditableCell's select options; the leading "(uncategorized)" entry is
   * appended by this component so callers don't have to.
   */
  categoryOptions?: ReadonlyArray<SelectOption>
  /**
   * Called when the user picks a different category from a row's dropdown.
   * `categoryId` is the categories.id (empty string clears it).
   */
  onUpdateCategory?: (transactionId: string, categoryId: string) => void
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const year = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10) - 1
  const day = parseInt(m[3]!, 10)
  const d = new Date(Date.UTC(year, month, day))
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * Inline drawer rendered beneath a BudgetRow when the user clicks the
 * row's "Actual" cell. Lists every transaction that contributed to the
 * row's `actual` total, with date + description + amount. The sum of
 * displayed amounts matches the header `totalActual` exactly (using the
 * same match rule as deriveBudgetVsActual).
 */
export function BudgetRowDrawer({
  category,
  transactions,
  totalActual,
  onClose,
  categoryOptions,
  onUpdateCategory
}: BudgetRowDrawerProps) {
  const isEmpty = transactions.length === 0
  const canEditCategory = categoryOptions != null && onUpdateCategory != null
  // Prepend the (uncategorized) option so users have an explicit "clear" choice.
  const optionsWithClear: ReadonlyArray<SelectOption> = categoryOptions
    ? [{ value: '', label: '(uncategorized)' }, ...categoryOptions]
    : []

  return (
    <div className="bg-gray-50 border-t border-rule px-4 py-3">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs text-muted">
          {isEmpty ? (
            <>No transactions contribute to <span className="text-ink font-medium">{category}</span> for this period.</>
          ) : (
            <>
              <span className="text-ink font-medium">{transactions.length}</span>{' '}
              {transactions.length === 1 ? 'transaction' : 'transactions'} sum to{' '}
              <span className="text-ink font-medium tabular">{formatUSD(totalActual)}</span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close transactions list"
          className="p-1 rounded text-muted hover:text-ink hover:bg-gray-200"
        >
          <X size={14} />
        </button>
      </div>

      {!isEmpty && (
        <ul className="divide-y divide-gray-200/70 rounded-md border border-rule bg-surface overflow-hidden">
          {transactions.map(tx => (
            <li
              key={tx.id}
              className={cn(
                'grid gap-3 items-center px-3 py-2 text-xs hover:bg-gray-50',
                canEditCategory
                  ? 'grid-cols-[64px_1fr_140px_auto]'
                  : 'grid-cols-[64px_1fr_auto]'
              )}
            >
              <span className="text-muted tabular">{formatShortDate(tx.date)}</span>
              <span className="text-ink truncate min-w-0">
                {tx.description || <span className="italic text-muted">No description</span>}
                {tx.account && (
                  <span className="text-muted ml-1.5">· {tx.account}</span>
                )}
                {tx.member && (
                  <span className="text-muted ml-1.5">· {tx.member}</span>
                )}
              </span>
              {canEditCategory && (
                <EditableCell
                  variant="select"
                  value={tx.category_id ?? ''}
                  options={optionsWithClear}
                  onCommit={(next) => onUpdateCategory!(tx.id, next)}
                  display={
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px]',
                        'bg-gray-100 text-gray-700'
                      )}
                      title="Click to recategorize"
                    >
                      {tx.category ?? 'Uncategorized'}
                    </span>
                  }
                />
              )}
              <span className="text-right tabular text-ink font-medium">
                {formatUSD(Math.abs(tx.amount))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
