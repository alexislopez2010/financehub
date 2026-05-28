'use client'

import { cn } from '@/lib/cn'
import type { SortKey, SortState } from '@/lib/ledger/sortTransactions'

export interface SortableHeaderProps {
  sort: SortState | null
  onSortChange: (next: SortState | null) => void
  /** Whether the checkbox column is shown (selection enabled). */
  showCheckboxColumn: boolean
}

interface ColumnDef {
  key: SortKey
  label: string
  /** Right-align the label (Amount). */
  alignEnd?: boolean
  /** Hidden below the `sm` breakpoint to mirror TransactionRow. */
  hideOnMobile?: boolean
}

// Mirrors TransactionRow's desktop layout:
// date | description | category | account | member | amount
// On mobile the row collapses to: date | description | amount
// so Category / Account / Member headers hide below `sm`.
const COLUMNS: ReadonlyArray<ColumnDef> = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category', hideOnMobile: true },
  { key: 'account', label: 'Account', hideOnMobile: true },
  { key: 'member', label: 'Member', hideOnMobile: true },
  { key: 'amount', label: 'Amount', alignEnd: true }
]

/**
 * Three-state click cycle for a single column:
 * - inactive            → desc
 * - active & desc       → asc
 * - active & asc        → null (clears sort → back to month grouping)
 */
function nextSort(current: SortState | null, key: SortKey): SortState | null {
  if (!current || current.key !== key) return { key, dir: 'desc' }
  if (current.dir === 'desc') return { key, dir: 'asc' }
  return null
}

function Caret({ state }: { state: 'none' | 'asc' | 'desc' }) {
  if (state === 'asc') return <span aria-hidden="true">▲</span>
  if (state === 'desc') return <span aria-hidden="true">▼</span>
  // Faint neutral indicator on inactive sortable columns.
  return <span aria-hidden="true" className="opacity-30">↕</span>
}

/**
 * Clickable column-header row that aligns to TransactionRow's grid template.
 * Sticky so it stays visible while scrolling the flat sorted list. Each header
 * is a button; clicking cycles the sort (desc → asc → clear) for that column.
 */
export function SortableHeader({ sort, onSortChange, showCheckboxColumn }: SortableHeaderProps) {
  // Same templates as TransactionRow (without the actions column — the header
  // never renders a per-row menu). The trailing 28px spacer keeps Amount
  // aligned with rows that DO show the actions menu.
  const colCls = showCheckboxColumn
    ? 'grid-cols-[20px_60px_1fr_100px_28px] sm:grid-cols-[20px_60px_1fr_140px_120px_120px_120px_28px]'
    : 'grid-cols-[60px_1fr_100px_28px] sm:grid-cols-[60px_1fr_140px_120px_120px_120px_28px]'

  return (
    <div
      className={cn(
        'grid gap-3 items-center px-4 py-2 sticky top-0 z-10 bg-surface border-b border-rule',
        colCls
      )}
    >
      {showCheckboxColumn && <div aria-hidden="true" />}
      {COLUMNS.map(col => {
        const isActive = sort?.key === col.key
        const caretState = isActive ? sort!.dir : 'none'
        return (
          <button
            key={col.key}
            type="button"
            onClick={() => onSortChange(nextSort(sort, col.key))}
            aria-label={`Sort by ${col.label}`}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-1 text-[11px] uppercase tracking-wider',
              'focus:outline-none focus-visible:underline hover:text-ink transition-colors',
              col.alignEnd && 'justify-end',
              col.hideOnMobile && 'hidden sm:flex',
              isActive ? 'text-ink font-semibold' : 'text-muted font-medium'
            )}
          >
            <span>{col.label}</span>
            <Caret state={caretState} />
          </button>
        )
      })}
      {/* Trailing spacer aligns with the per-row actions-menu column. */}
      <div aria-hidden="true" />
    </div>
  )
}
