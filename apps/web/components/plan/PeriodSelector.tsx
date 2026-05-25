'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { navigatePeriod, periodLabel, type PlanPeriod } from '@/lib/plan/period'
import { cn } from '@/lib/cn'

export interface PeriodSelectorProps {
  period: PlanPeriod
  onChange: (next: PlanPeriod) => void
  className?: string
}

const MONTH_OPTIONS = [
  { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
  { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
  { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
  { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' }
]

export function PeriodSelector({ period, onChange, className }: PeriodSelectorProps) {
  const [showPicker, setShowPicker] = useState(false)
  const yearStart = period.year - 3
  const yearOptions: number[] = []
  for (let y = yearStart; y <= yearStart + 6; y += 1) yearOptions.push(y)

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <button
        type="button"
        onClick={() => onChange(navigatePeriod(period, -1))}
        aria-label="Previous month"
        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-gray-100 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        onClick={() => setShowPicker(v => !v)}
        className={cn(
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg',
          'text-sm font-medium text-ink hover:bg-gray-100 transition-colors'
        )}
      >
        {periodLabel(period)}
      </button>

      <button
        type="button"
        onClick={() => onChange(navigatePeriod(period, 1))}
        aria-label="Next month"
        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-gray-100 transition-colors"
      >
        <ChevronRight size={16} />
      </button>

      {showPicker && (
        <div className="relative">
          <div
            className="absolute right-0 mt-2 z-20 rounded-xl bg-surface border border-rule shadow-lg p-3 grid grid-cols-2 gap-2"
            style={{ minWidth: 220 }}
          >
            <select
              value={period.month}
              onChange={e => { onChange({ year: period.year, month: parseInt(e.target.value, 10) }); setShowPicker(false) }}
              className="text-sm rounded-md border border-rule px-2 py-1 bg-bg"
            >
              {MONTH_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <select
              value={period.year}
              onChange={e => { onChange({ year: parseInt(e.target.value, 10), month: period.month }); setShowPicker(false) }}
              className="text-sm rounded-md border border-rule px-2 py-1 bg-bg"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
