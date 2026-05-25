'use client'

import { Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'
import { daysUntilDue } from '@/lib/finance/dueDate'
import { nextDueDate } from '@/lib/bills/sort'
import { EditableCell } from '@/components/ledger/EditableCell'
import { cn } from '@/lib/cn'

type BillRow = Tables<'bills'>

export interface BillRowProps {
  bill: BillRow
  today: { year: number; month: number; day: number }
  expanded?: boolean
  onToggleExpanded?: () => void
  onEditName?: (next: string) => void
  onEditDueDay?: (next: number) => void
  onEditAmount?: (next: number) => void
  onDelete?: () => void
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

export function BillRow({
  bill, today, expanded, onToggleExpanded,
  onEditName, onEditDueDay, onEditAmount, onDelete
}: BillRowProps) {
  const days = bill.due_day == null ? null : daysUntilDue({ due_day: bill.due_day }, today)
  const due = dueLabel(days)
  const nextDate = nextDueDate(bill, today)
  const showDelete = onDelete !== undefined
  const showToggle = onToggleExpanded !== undefined

  const cols = (() => {
    if (showToggle && showDelete) {
      return 'grid-cols-[24px_1fr_90px_110px_28px] sm:grid-cols-[24px_1fr_140px_120px_140px_28px]'
    }
    if (showToggle) {
      return 'grid-cols-[24px_1fr_90px_110px] sm:grid-cols-[24px_1fr_140px_120px_140px]'
    }
    if (showDelete) {
      return 'grid-cols-[1fr_90px_110px_28px] sm:grid-cols-[1fr_140px_120px_140px_28px]'
    }
    return 'grid-cols-[1fr_90px_110px] sm:grid-cols-[1fr_140px_120px_140px]'
  })()

  return (
    <div className={cn(
      'grid gap-3 items-center px-4 py-3 text-sm transition-colors',
      expanded ? 'bg-blue-50/40' : 'hover:bg-gray-50',
      cols
    )}>
      {showToggle && (
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-label={expanded ? 'Collapse matched transactions' : 'Expand matched transactions'}
          className="p-1 -ml-1 rounded text-muted hover:text-ink hover:bg-gray-100"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      )}

      <div className="min-w-0">
        {onEditName ? (
          <EditableCell
            variant="text"
            value={bill.name}
            onCommit={onEditName}
            display={<span className="text-ink font-medium truncate block">{bill.name}</span>}
          />
        ) : (
          <div className="text-ink font-medium truncate">{bill.name}</div>
        )}
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

      <div className="text-right text-xs tabular">
        {onEditDueDay ? (
          <div className="space-y-0.5">
            <EditableCell
              variant="number"
              value={bill.due_day ?? 0}
              onCommit={(n) => onEditDueDay(Math.min(Math.max(Math.round(n), 1), 31))}
              display={<span className={cn('block', due.tone)}>{due.text}</span>}
              inputClassName="text-right"
            />
            {nextDate && <div className="text-[10px] text-muted">{nextDate}</div>}
          </div>
        ) : (
          <>
            <div className={due.tone}>{due.text}</div>
            {nextDate && <div className="text-[10px] text-muted">{nextDate}</div>}
          </>
        )}
      </div>

      <div className="hidden sm:block text-xs text-muted truncate" title={bill.account ?? ''}>
        {bill.account ?? ''}
      </div>

      <div className="text-right tabular text-sm text-ink font-semibold">
        {onEditAmount ? (
          <EditableCell
            variant="number"
            value={bill.budget_amount}
            onCommit={onEditAmount}
            display={<span className="font-semibold">{formatUSD(bill.budget_amount)}</span>}
            inputClassName="text-right"
          />
        ) : (
          formatUSD(bill.budget_amount)
        )}
      </div>

      {showDelete && (
        <div className="text-right">
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete bill ${bill.name}`}
            className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
