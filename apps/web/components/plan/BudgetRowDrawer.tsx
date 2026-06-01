'use client'

import { X } from 'lucide-react'
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
export function BudgetRowDrawer({ category, transactions, totalActual, onClose }: BudgetRowDrawerProps) {
  const isEmpty = transactions.length === 0

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
                'grid grid-cols-[64px_1fr_auto] gap-3 items-center px-3 py-2 text-xs',
                'hover:bg-gray-50'
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
