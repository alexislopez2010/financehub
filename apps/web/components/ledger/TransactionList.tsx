'use client'

import { useEffect, useRef } from 'react'
import { groupByMonth, type TransactionRow as TxRow } from '@/lib/ledger/groupByMonth'
import { TransactionRow } from './TransactionRow'
import { SortableHeader } from './SortableHeader'
import type { DemoteTransferTarget } from './RowActionsMenu'
import type { SelectOption } from './EditableCell'
import type { SortState } from '@/lib/ledger/sortTransactions'
import { cn } from '@/lib/cn'

export interface SelectAllRowProps {
  selectedIds: ReadonlySet<string>
  txIds: ReadonlyArray<string>
  onSelectAll: (next: Set<string>) => void
}

/**
 * Master checkbox row rendered above the first month group when the parent
 * Ledger wires selection. Toggles all currently-visible (filtered) transaction
 * ids on or off using a native HTML checkbox with three states (unchecked,
 * indeterminate, checked).
 *
 * Click semantics:
 * - Unchecked (0 selected) → select all visible
 * - Indeterminate (1 ≤ N < total) → clear
 * - Checked (N === total) → clear
 */
export function SelectAllRow({ selectedIds, txIds, onSelectAll }: SelectAllRowProps) {
  const ref = useRef<HTMLInputElement>(null)
  const total = txIds.length
  const count = selectedIds.size
  const isEmpty = total === 0
  const allChecked = !isEmpty && count === total
  const isIndeterminate = count > 0 && count < total

  // React doesn't accept `indeterminate` as a prop on <input>; we set the DOM
  // property directly whenever the derived state changes.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = isIndeterminate
  }, [isIndeterminate])

  function handleChange() {
    if (count === 0) {
      onSelectAll(new Set(txIds))
    } else {
      onSelectAll(new Set())
    }
  }

  function handleClear() {
    onSelectAll(new Set())
  }

  const label = isEmpty
    ? 'No transactions match the current filters.'
    : allChecked
      ? 'All selected'
      : 'Select all'

  return (
    <div className="px-4 py-2 border-b border-rule bg-surface flex items-center justify-between">
      <label className="flex items-center gap-3 text-sm text-ink cursor-pointer select-none">
        <input
          ref={ref}
          type="checkbox"
          checked={allChecked}
          disabled={isEmpty}
          onChange={handleChange}
          aria-label="Select all transactions"
          className="w-4 h-4 accent-brand cursor-pointer disabled:cursor-not-allowed"
        />
        <span className={cn(isEmpty && 'text-muted')}>{label}</span>
      </label>
      <div className="text-xs text-muted tabular flex items-center gap-2">
        {isEmpty ? (
          <span>0 transactions</span>
        ) : count === 0 ? (
          <span>{total} transactions filtered</span>
        ) : (
          <>
            <span>{count} of {total} selected</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleClear}
              className="text-brand hover:underline focus:outline-none focus:underline"
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export interface TransactionListProps {
  transactions: ReadonlyArray<TxRow>
  selectedIds?: ReadonlySet<string>
  onToggleSelect?: (id: string, selected: boolean) => void
  /**
   * Ids of all currently-visible (filtered) transactions. Required to enable
   * the master Select-all row. When provided together with `selectedIds` and
   * `onSelectAll`, a master checkbox renders above the first month group.
   */
  txIds?: ReadonlyArray<string>
  onSelectAll?: (next: Set<string>) => void
  categoryOptions?: ReadonlyArray<SelectOption>
  /**
   * Household member roster threaded down to each row's Member select.
   * Passing this once at the list level avoids calling
   * `useHouseholdMembersList` per row.
   */
  members?: ReadonlyArray<{ display_name: string }>
  /** Edit handlers — called with the tx id + new value. */
  onEditDescription?: (id: string, next: string) => void
  onEditAmount?: (id: string, next: number) => void
  onEditCategory?: (id: string, next: string) => void
  /** Commit handler for the Member field. `next` is null for '(Unassigned)'. */
  onEditMember?: (id: string, next: string | null) => void
  onPromote?: (tx: TxRow) => void
  onDelete?: (id: string) => void
  onConvertToTransfer?: (tx: TxRow) => void
  /** Same dialog as Convert — for orphan Transfer rows. */
  onPairTransfer?: (tx: TxRow) => void
  onUnpairTransfer?: (id: string) => void
  /** Demote an orphan Transfer to Expense / Income / Refund. */
  onDemoteTransfer?: (id: string, next: DemoteTransferTarget) => void
  /** Toggles the row's exclude_from_runway flag (one-off discretionary). */
  onToggleExcludeFromRunway?: (id: string, next: boolean) => void
  /** Id of the row currently mid-unpair RPC (disables menu item + shows "Unpairing…"). */
  unpairingId?: string | null
  /**
   * Active sort. When non-null the list renders FLAT (no month grouping) and
   * the parent is expected to pass `transactions` already globally sorted.
   * When null the familiar month-grouped, newest-first view renders.
   */
  sort?: SortState | null
  /**
   * When provided, a sticky <SortableHeader> renders so the user can sort by
   * column. Omitting it hides the header (and keeps the legacy grouped view).
   */
  onSortChange?: (next: SortState | null) => void
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function TransactionList({
  transactions,
  selectedIds,
  onToggleSelect,
  txIds,
  onSelectAll,
  categoryOptions,
  members,
  onEditDescription,
  onEditAmount,
  onEditCategory,
  onEditMember,
  onPromote,
  onDelete,
  onConvertToTransfer,
  onPairTransfer,
  onUnpairTransfer,
  onDemoteTransfer,
  onToggleExcludeFromRunway,
  unpairingId,
  sort,
  onSortChange
}: TransactionListProps) {
  const showSelectAll = selectedIds !== undefined && txIds !== undefined && onSelectAll !== undefined
  const isEmpty = transactions.length === 0

  // Per-row props are identical in both grouped and flat modes; build them once.
  function renderRow(tx: TxRow) {
    return (
      <TransactionRow
        tx={tx}
        {...(selectedIds !== undefined && onToggleSelect !== undefined
          ? {
              selected: selectedIds.has(tx.id),
              onSelectChange: (sel: boolean) => onToggleSelect(tx.id, sel)
            }
          : {})}
        {...(categoryOptions ? { categoryOptions } : {})}
        {...(members ? { members } : {})}
        {...(onEditDescription ? { onEditDescription: (next: string) => onEditDescription(tx.id, next) } : {})}
        {...(onEditAmount ? { onEditAmount: (next: number) => onEditAmount(tx.id, next) } : {})}
        {...(onEditCategory ? { onEditCategory: (next: string) => onEditCategory(tx.id, next) } : {})}
        {...(onEditMember ? { onEditMember: (next: string | null) => onEditMember(tx.id, next) } : {})}
        {...(onPromote ? { onPromote: () => onPromote(tx) } : {})}
        {...(onDelete ? { onDelete: () => onDelete(tx.id) } : {})}
        {...(onConvertToTransfer ? { onConvertToTransfer: () => onConvertToTransfer(tx) } : {})}
        {...(onPairTransfer ? { onPairTransfer: () => onPairTransfer(tx) } : {})}
        {...(onUnpairTransfer ? { onUnpairTransfer: () => onUnpairTransfer(tx.id) } : {})}
        {...(onDemoteTransfer ? { onDemoteTransfer: (next: DemoteTransferTarget) => onDemoteTransfer(tx.id, next) } : {})}
        {...(onToggleExcludeFromRunway ? { onToggleExcludeFromRunway: (next: boolean) => onToggleExcludeFromRunway(tx.id, next) } : {})}
        {...(unpairingId === tx.id ? { unpairing: true } : {})}
      />
    )
  }

  if (isEmpty) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        No transactions match these filters.
      </div>
    )
  }

  const groups = groupByMonth(transactions)

  return (
    <div className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      {showSelectAll && (
        <SelectAllRow
          selectedIds={selectedIds}
          txIds={txIds}
          onSelectAll={onSelectAll}
        />
      )}
      {onSortChange && (
        <SortableHeader
          sort={sort ?? null}
          onSortChange={onSortChange}
          showCheckboxColumn={showSelectAll}
        />
      )}
      {sort ? (
        // Flat, globally-sorted view: month grouping drops away so identical
        // values cluster together. Parent passes `transactions` pre-sorted.
        <ul className="divide-y divide-gray-100">
          {transactions.map(tx => (
            <li key={tx.id}>{renderRow(tx)}</li>
          ))}
        </ul>
      ) : (
        groups.map(g => (
          <section key={g.ym}>
            <header className={cn(
              'sticky top-0 z-10 bg-gray-50 border-b border-rule',
              'px-4 py-2 flex items-baseline justify-between'
            )}>
              <h3 className="text-xs uppercase tracking-[0.12em] font-semibold text-gray-700">{g.label}</h3>
              <div className="text-xs text-muted tabular">
                {g.totalIncome > 0 && (
                  <span>
                    <span className="text-emerald-600 font-medium">{formatUSD(g.totalIncome)}</span> in
                  </span>
                )}
                {g.totalExpense > 0 && (
                  <span className={cn(g.totalIncome > 0 && 'ml-3')}>
                    <span className="text-red-600 font-medium">{formatUSD(g.totalExpense)}</span> out
                  </span>
                )}
                {g.totalTransfers > 0 && (
                  <span className={cn((g.totalIncome > 0 || g.totalExpense > 0) && 'ml-3')}>
                    <span className="text-muted font-medium">{formatUSD(g.totalTransfers)}</span> transfers
                  </span>
                )}
              </div>
            </header>
            <ul className="divide-y divide-gray-100">
              {g.items.map(tx => (
                <li key={tx.id}>{renderRow(tx)}</li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
