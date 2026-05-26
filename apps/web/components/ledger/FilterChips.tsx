'use client'

import type { LedgerFilters } from '@/lib/ledger/filters'
import { isEmpty } from '@/lib/ledger/filters'
import { DescriptionSearch } from './filters/DescriptionSearch'
import { DateRangeFilter } from './filters/DateRangeFilter'
import { AccountFilter } from './filters/AccountFilter'
import { CategoryFilter } from './filters/CategoryFilter'
import { MemberFilter } from './filters/MemberFilter'
import { AmountFilter } from './filters/AmountFilter'
import { TypeFilter } from './filters/TypeFilter'
import { cn } from '@/lib/cn'

export interface FilterChipsProps {
  filters: LedgerFilters
  onChange: (next: LedgerFilters) => void
  /** Optional: prompt the bottom-sheet on mobile. */
  onOpenSheet?: () => void
  className?: string
}

/**
 * Apply a single-field patch where `undefined` means "delete this key".
 * Necessary because LedgerFilters uses exactOptionalPropertyTypes — a key
 * cannot be assigned `undefined`; it must be omitted.
 */
function applyOptional<K extends keyof LedgerFilters>(
  filters: LedgerFilters,
  key: K,
  value: LedgerFilters[K] | undefined
): LedgerFilters {
  const next = { ...filters }
  if (value === undefined) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}

export function FilterChips({ filters, onChange, onOpenSheet, className }: FilterChipsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <DescriptionSearch
        value={filters.q ?? ''}
        onChange={(q) => onChange(applyOptional(filters, 'q', q || undefined))}
      />
      <DateRangeFilter
        value={{ startDate: filters.startDate, endDate: filters.endDate }}
        onChange={(v) => {
          let next = applyOptional(filters, 'startDate', v.startDate)
          next = applyOptional(next, 'endDate', v.endDate)
          onChange(next)
        }}
      />
      <AccountFilter
        value={filters.account}
        onChange={(account) => onChange(applyOptional(filters, 'account', account))}
      />
      <CategoryFilter
        value={filters.categoryId}
        onChange={(categoryId) => {
          // categoryId === null is meaningful ("Uncategorized"); applyOptional
          // does the right thing because null !== undefined.
          onChange(applyOptional(filters, 'categoryId', categoryId))
        }}
      />
      <MemberFilter
        value={filters.member}
        onChange={(member) => onChange(applyOptional(filters, 'member', member))}
      />
      <AmountFilter
        value={{ minAmount: filters.minAmount, maxAmount: filters.maxAmount }}
        onChange={(v) => {
          let next = applyOptional(filters, 'minAmount', v.minAmount)
          next = applyOptional(next, 'maxAmount', v.maxAmount)
          onChange(next)
        }}
      />
      <TypeFilter
        value={filters.type}
        onChange={(type) => onChange(applyOptional(filters, 'type', type))}
      />

      {!isEmpty(filters) && (
        <button
          type="button"
          onClick={() => onChange({})}
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
