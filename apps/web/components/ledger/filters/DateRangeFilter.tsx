'use client'

import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DateRangeValue {
  startDate: string | undefined
  endDate: string | undefined
}

export interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface QuickRange {
  label: string
  compute: (today: Date) => DateRangeValue
}

const QUICK_RANGES: ReadonlyArray<QuickRange> = [
  {
    label: 'Last 30 days',
    compute: (today) => {
      const start = new Date(today)
      start.setDate(start.getDate() - 30)
      return { startDate: toIso(start), endDate: toIso(today) }
    }
  },
  {
    label: 'This month',
    compute: (today) => {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { startDate: toIso(start), endDate: toIso(today) }
    }
  },
  {
    label: 'Last month',
    compute: (today) => {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { startDate: toIso(start), endDate: toIso(end) }
    }
  },
  {
    label: 'YTD',
    compute: (today) => {
      const start = new Date(today.getFullYear(), 0, 1)
      return { startDate: toIso(start), endDate: toIso(today) }
    }
  }
]

function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${m}/${d}`
}

function formatChip(value: DateRangeValue): string {
  const { startDate, endDate } = value
  if (startDate && endDate) {
    const sameYear = startDate.slice(0, 4) === endDate.slice(0, 4)
    if (sameYear) return `${formatShort(startDate)} – ${formatShort(endDate)}`
    return `${startDate} – ${endDate}`
  }
  if (startDate) return `from ${formatShort(startDate)}`
  if (endDate) return `through ${formatShort(endDate)}`
  return ''
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(value.startDate ?? '')
  const [draftEnd, setDraftEnd] = useState(value.endDate ?? '')

  // Re-sync draft when popover opens or external value changes
  useEffect(() => {
    if (open) {
      setDraftStart(value.startDate ?? '')
      setDraftEnd(value.endDate ?? '')
    }
  }, [open, value.startDate, value.endDate])

  const isSet = value.startDate !== undefined || value.endDate !== undefined

  if (isSet) {
    return (
      <div className="inline-flex">
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Edit date range filter"
              className={cn(
                'inline-flex items-center gap-1 pl-2 py-1 rounded-l-full text-xs',
                'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
              )}
            >
              <span className="font-medium">date:</span>
              <span>{formatChip(value)}</span>
            </button>
          </DropdownMenu.Trigger>
          <DateRangeMenu
            draftStart={draftStart}
            draftEnd={draftEnd}
            setDraftStart={setDraftStart}
            setDraftEnd={setDraftEnd}
            onApply={() => {
              onChange({
                startDate: draftStart || undefined,
                endDate: draftEnd || undefined
              })
              setOpen(false)
            }}
            onClear={() => {
              onChange({ startDate: undefined, endDate: undefined })
              setOpen(false)
            }}
          />
        </DropdownMenu.Root>
        <button
          type="button"
          onClick={() => onChange({ startDate: undefined, endDate: undefined })}
          aria-label="Clear date filter"
          className={cn(
            'inline-flex items-center px-1.5 rounded-r-full',
            'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-warn transition-colors'
          )}
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Filter by date"
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-2 py-1 rounded-full text-xs',
            'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
          )}
        >
          <span className="font-medium">Date</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DateRangeMenu
        draftStart={draftStart}
        draftEnd={draftEnd}
        setDraftStart={setDraftStart}
        setDraftEnd={setDraftEnd}
        onApply={() => {
          onChange({
            startDate: draftStart || undefined,
            endDate: draftEnd || undefined
          })
          setOpen(false)
        }}
        onClear={() => {
          setDraftStart('')
          setDraftEnd('')
          onChange({ startDate: undefined, endDate: undefined })
          setOpen(false)
        }}
      />
    </DropdownMenu.Root>
  )
}

interface DateRangeMenuProps {
  draftStart: string
  draftEnd: string
  setDraftStart: (v: string) => void
  setDraftEnd: (v: string) => void
  onApply: () => void
  onClear: () => void
}

function DateRangeMenu({
  draftStart,
  draftEnd,
  setDraftStart,
  setDraftEnd,
  onApply,
  onClear
}: DateRangeMenuProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="start"
        sideOffset={4}
        className={cn(
          'z-50 w-[280px] rounded-lg bg-surface border border-rule shadow-lg p-3',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0'
        )}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {QUICK_RANGES.map(r => (
            <button
              key={r.label}
              type="button"
              onClick={() => {
                const v = r.compute(new Date())
                setDraftStart(v.startDate ?? '')
                setDraftEnd(v.endDate ?? '')
              }}
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-[11px]',
                'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted block mb-1">From</span>
            <input
              type="date"
              value={draftStart}
              onChange={e => setDraftStart(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm rounded-md bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted block mb-1">To</span>
            <input
              type="date"
              value={draftEnd}
              onChange={e => setDraftEnd(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm rounded-md bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-rule">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted hover:text-ink px-2 py-1"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className="px-3 py-1 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand/90"
          >
            Apply
          </button>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}
