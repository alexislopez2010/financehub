'use client'

import { groupByMonth, type TransactionRow as TxRow } from '@/lib/ledger/groupByMonth'
import { TransactionRow } from './TransactionRow'
import type { DemoteTransferTarget } from './RowActionsMenu'
import type { SelectOption } from './EditableCell'
import { cn } from '@/lib/cn'

export interface TransactionListProps {
  transactions: ReadonlyArray<TxRow>
  selectedIds?: ReadonlySet<string>
  onToggleSelect?: (id: string, selected: boolean) => void
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
  /** Id of the row currently mid-unpair RPC (disables menu item + shows "Unpairing…"). */
  unpairingId?: string | null
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function TransactionList({
  transactions,
  selectedIds,
  onToggleSelect,
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
  unpairingId
}: TransactionListProps) {
  const groups = groupByMonth(transactions)

  if (groups.length === 0) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        No transactions match these filters.
      </div>
    )
  }

  return (
    <div className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      {groups.map(g => (
        <section key={g.ym}>
          <header className={cn(
            'sticky top-0 z-10 bg-gray-50 border-b border-rule',
            'px-4 py-2 flex items-baseline justify-between'
          )}>
            <h3 className="text-xs uppercase tracking-[0.12em] font-semibold text-gray-700">{g.label}</h3>
            <div className="text-xs text-muted tabular">
              <span className="text-red-600 font-medium">{formatUSD(g.totalExpense)}</span> out
              {g.totalIncome > 0 && (
                <span className="ml-3">
                  <span className="text-emerald-600 font-medium">{formatUSD(g.totalIncome)}</span> in
                </span>
              )}
            </div>
          </header>
          <ul className="divide-y divide-gray-100">
            {g.items.map(tx => (
              <li key={tx.id}>
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
                  {...(unpairingId === tx.id ? { unpairing: true } : {})}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
