'use client'

import type { Tables } from '@/lib/supabase/database.types'
import { daysUntilDue } from '@/lib/finance/dueDate'
import { nextDueDate } from '@/lib/bills/sort'
import { cn } from '@/lib/cn'

type BillRow = Tables<'bills'>

export interface BillRowProps {
  bill: BillRow
  today: { year: number; month: number; day: number }
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function dueLabel(days: number | null): { text: string; tone: string } {
  if (days == null) return { text: '—', tone: 'text-muted' }
  if (days === 0) return { text: 'today', tone: 'text-red-600 font-semibold' }
  if (days === 1) return { text: 'tomorrow', tone: 'text-amber-600 font-semibold' }
  if (days <= 3) return { text: `in ${days} days`, tone: 'text-amber-600' }
  if (days <= 7) return { text: `in ${days} days`, tone: 'text-ink' }
  return { text: `in ${days} days`, tone: 'text-muted' }
}

export function BillRow({ bill, today }: BillRowProps) {
  const days = bill.due_day == null ? null : daysUntilDue({ due_day: bill.due_day }, today)
  const due = dueLabel(days)
  const nextDate = nextDueDate(bill, today)

  return (
    <div className={cn(
      'grid grid-cols-[1fr_90px_110px] sm:grid-cols-[1fr_140px_120px_140px] gap-3 items-center',
      'px-4 py-3 text-sm hover:bg-gray-50 transition-colors'
    )}>
      <div className="min-w-0">
        <div className="text-ink font-medium truncate">{bill.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {bill.category && <span className="text-xs text-muted">{bill.category}</span>}
          {bill.frequency && (
            <>
              <span className="text-xs text-muted/60">·</span>
              <span className="text-xs text-muted">{bill.frequency}</span>
            </>
          )}
        </div>
      </div>

      <div className={cn('text-right text-xs tabular', due.tone)}>
        <div>{due.text}</div>
        {nextDate && <div className="text-[10px] text-muted">{nextDate}</div>}
      </div>

      <div className="hidden sm:block text-xs text-muted truncate" title={bill.account ?? ''}>
        {bill.account ?? ''}
      </div>

      <div className="text-right tabular text-sm text-ink font-semibold">
        {formatUSD(bill.budget_amount)}
      </div>
    </div>
  )
}
