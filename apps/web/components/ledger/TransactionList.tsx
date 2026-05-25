'use client'

import { groupByMonth, type TransactionRow as TxRow } from '@/lib/ledger/groupByMonth'
import { TransactionRow } from './TransactionRow'
import { cn } from '@/lib/cn'

export interface TransactionListProps {
  transactions: ReadonlyArray<TxRow>
  selectedIds?: ReadonlySet<string>
  onToggleSelect?: (id: string, selected: boolean) => void
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function TransactionList({ transactions, selectedIds, onToggleSelect }: TransactionListProps) {
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
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
