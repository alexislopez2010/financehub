'use client'

import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'

export type TransactionRow = Tables<'transactions'>

export interface TransactionRowProps {
  tx: TransactionRow
}

const typeAmountTone: Record<string, string> = {
  Income: 'text-emerald-600',
  Refund: 'text-emerald-600',
  Expense: 'text-red-600',
  Transfer: 'text-muted'
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDay(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}`
}

export function TransactionRow({ tx }: TransactionRowProps) {
  const tone = typeAmountTone[tx.type] ?? 'text-ink'
  const sign = tx.type === 'Income' || tx.type === 'Refund' ? '+' : tx.type === 'Expense' ? '−' : ''
  const amountStr = `${sign}${formatUSD(Math.abs(tx.amount))}`

  return (
    <div className={cn(
      'grid grid-cols-[60px_1fr_120px_100px] sm:grid-cols-[60px_1fr_140px_120px_120px] gap-3 items-center',
      'px-4 py-2.5 hover:bg-gray-50 transition-colors text-sm'
    )}>
      <div className="text-xs text-muted tabular">{formatDay(tx.date)}</div>
      <div className="text-ink truncate" title={tx.description}>{tx.description}</div>
      <div className="hidden sm:block">
        {tx.category && (
          <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-md text-xs',
            'bg-gray-100 text-gray-700'
          )}>
            {tx.category}
          </span>
        )}
      </div>
      <div className="hidden sm:block text-xs text-muted truncate" title={tx.account ?? ''}>
        {tx.account ?? ''}
      </div>
      <div className={cn('text-right tabular font-medium', tone)}>
        {amountStr}
      </div>
    </div>
  )
}
