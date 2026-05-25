'use client'

import { Search, X } from 'lucide-react'
import type { LedgerFilters } from '@/lib/ledger/filters'
import { isEmpty } from '@/lib/ledger/filters'
import { cn } from '@/lib/cn'

export interface FilterChipsProps {
  filters: LedgerFilters
  onChange: (next: LedgerFilters) => void
  /** Optional: prompt the bottom-sheet on mobile. */
  onOpenSheet?: () => void
  className?: string
}

interface ChipDef {
  key: keyof LedgerFilters
  label: string
  value: string
}

function chipsFor(filters: LedgerFilters): ReadonlyArray<ChipDef> {
  const out: ChipDef[] = []
  if (filters.startDate || filters.endDate) {
    const s = filters.startDate ?? '…'
    const e = filters.endDate ?? '…'
    out.push({ key: 'startDate', label: 'date', value: `${s} → ${e}` })
  }
  if (filters.categoryId !== undefined) {
    out.push({ key: 'categoryId', label: 'category', value: filters.categoryId === null ? 'Uncategorized' : filters.categoryId.slice(0, 8) })
  }
  if (filters.account) out.push({ key: 'account', label: 'account', value: filters.account })
  if (filters.member) out.push({ key: 'member', label: 'member', value: filters.member })
  if (filters.type) out.push({ key: 'type', label: 'type', value: filters.type })
  return out
}

export function FilterChips({ filters, onChange, onOpenSheet, className }: FilterChipsProps) {
  const chips = chipsFor(filters)

  function clearChip(key: keyof LedgerFilters) {
    const next = { ...filters }
    if (key === 'startDate') {
      delete next.startDate
      delete next.endDate
    } else {
      delete next[key]
    }
    onChange(next)
  }

  function resetAll() {
    onChange({})
  }

  function setQuery(value: string) {
    if (value) onChange({ ...filters, q: value })
    else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { q, ...rest } = filters
      onChange(rest)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={filters.q ?? ''}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search description…"
          className={cn(
            'w-full pl-9 pr-3 py-1.5 text-sm rounded-lg',
            'bg-surface border border-rule text-ink',
            'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/20'
          )}
        />
      </div>

      {chips.map(c => (
        <button
          key={String(c.key)}
          type="button"
          onClick={() => clearChip(c.key)}
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs',
            'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
          )}
        >
          <span className="font-medium">{c.label}:</span>
          <span>{c.value}</span>
          <X size={12} className="ml-1" />
        </button>
      ))}

      {!isEmpty(filters) && (
        <button
          type="button"
          onClick={resetAll}
          className="ml-1 text-xs text-muted hover:text-ink"
        >
          Reset
        </button>
      )}

      {onOpenSheet && (
        <button
          type="button"
          onClick={onOpenSheet}
          className="md:hidden text-xs text-brand font-medium ml-auto"
        >
          Filters
        </button>
      )}
    </div>
  )
}
