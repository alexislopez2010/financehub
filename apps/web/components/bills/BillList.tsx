'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useMemo } from 'react'
import type { Tables } from '@/lib/supabase/database.types'
import { billComparator, type BillSortKey } from '@/lib/bills/sort'
import { BillRow } from './BillRow'
import { cn } from '@/lib/cn'

type Bill = Tables<'bills'>

export interface BillListProps {
  bills: ReadonlyArray<Bill>
  sortKey: BillSortKey
  onSortChange: (key: BillSortKey) => void
  today: { year: number; month: number; day: number }
}

interface ColHeader {
  key: BillSortKey
  label: string
  className: string
}

const HEADERS: ReadonlyArray<ColHeader> = [
  { key: 'name',     label: 'Name',     className: 'text-left' },
  { key: 'due',      label: 'Next due', className: 'text-right' },
  { key: 'category', label: 'Account',  className: 'hidden sm:block text-left' },
  { key: 'amount',   label: 'Amount',   className: 'text-right' }
]

export function BillList({ bills, sortKey, onSortChange, today }: BillListProps) {
  const sorted = useMemo(() => {
    const copy = [...bills].filter(b => b.is_active !== false)
    copy.sort(billComparator(sortKey, today))
    return copy
  }, [bills, sortKey, today])

  if (sorted.length === 0) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        No bills yet.
      </div>
    )
  }

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      {/* Header row */}
      <div className={cn(
        'grid grid-cols-[1fr_90px_110px] sm:grid-cols-[1fr_140px_120px_140px] gap-3',
        'px-4 py-2 text-[10px] uppercase tracking-[0.12em] font-semibold text-muted bg-gray-50 border-b border-rule'
      )}>
        {HEADERS.map(h => {
          const active = sortKey === h.key
          const Icon = active ? ArrowDown : ArrowUpDown
          return (
            <button
              key={h.key}
              type="button"
              onClick={() => onSortChange(h.key)}
              className={cn(
                'inline-flex items-center gap-1 hover:text-ink transition-colors',
                active && 'text-ink',
                h.className
              )}
            >
              <span>{h.label}</span>
              <Icon size={10} className={cn(active ? 'opacity-100' : 'opacity-40')} />
            </button>
          )
        })}
      </div>

      <ul className="divide-y divide-gray-100">
        {sorted.map(b => (
          <li key={b.id}>
            <BillRow bill={b} today={today} />
          </li>
        ))}
      </ul>
    </section>
  )
}
