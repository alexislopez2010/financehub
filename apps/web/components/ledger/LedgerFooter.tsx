'use client'

import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'
import { activityDirection, signedActivity } from '@/lib/finance/signedActivity'

type TxRow = Tables<'transactions'>

export interface LedgerFooterProps {
  transactions: ReadonlyArray<TxRow>
  className?: string
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function deriveTotals(txs: ReadonlyArray<TxRow>): {
  count: number
  income: number
  expense: number
  transfers: number
  net: number
} {
  let income = 0
  let expense = 0
  let transfers = 0
  for (const tx of txs) {
    const dir = activityDirection(tx)
    if (dir === 'transfer') {
      transfers += Math.abs(signedActivity(tx))
      continue
    }
    const signed = signedActivity(tx)
    if (signed > 0) income += signed
    else if (signed < 0) expense += -signed
  }
  return {
    count: txs.length,
    income: round2(income),
    expense: round2(expense),
    transfers: round2(transfers),
    net: round2(income - expense)
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function LedgerFooter({ transactions, className }: LedgerFooterProps) {
  const t = deriveTotals(transactions)
  const netSign = t.net > 0 ? '+' : t.net < 0 ? '−' : ''
  const netTone = t.net > 0 ? 'text-emerald-600' : t.net < 0 ? 'text-red-600' : 'text-muted'

  return (
    <div
      role="status"
      className={cn(
        'sticky bottom-0 z-10',
        'bg-surface border border-rule rounded-xl shadow-sm',
        'px-4 sm:px-5 py-3 flex flex-wrap items-baseline justify-between gap-3',
        className
      )}
    >
      <div className="text-xs text-muted">
        <span className="font-medium text-ink tabular">{t.count.toLocaleString()}</span>{' '}
        transaction{t.count === 1 ? '' : 's'}
      </div>
      <div className="flex items-baseline gap-4 text-sm tabular">
        <span>
          <span className="text-xs text-muted mr-1">in</span>
          <span className="font-medium text-emerald-600">{formatUSD(t.income)}</span>
        </span>
        <span>
          <span className="text-xs text-muted mr-1">out</span>
          <span className="font-medium text-red-600">{formatUSD(t.expense)}</span>
        </span>
        {t.transfers > 0 && (
          <span>
            <span className="text-xs text-muted mr-1">transfers</span>
            <span className="font-medium text-muted">{formatUSD(t.transfers)}</span>
          </span>
        )}
        <span>
          <span className="text-xs text-muted mr-1">net</span>
          <span className={cn('font-semibold', netTone)}>
            {netSign}{formatUSD(Math.abs(t.net))}
          </span>
        </span>
      </div>
    </div>
  )
}

export { deriveTotals }
