'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Search, X } from 'lucide-react'
import { useHouseholdMembersList } from '@/lib/data/householdMembers'
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
  // Member is rendered via its own chip below so it can show a picker when unset.
  if (filters.type) out.push({ key: 'type', label: 'type', value: filters.type })
  return out
}

interface FilterMemberOption {
  /** Non-null string value to write into the filter. */
  value: string
  label: string
}

/**
 * Build the option list for the Member filter chip. Unlike the row-edit
 * dropdown, this does NOT include '(Unassigned)' — filtering for null
 * member is rarely useful and isn't worth a UI knob.
 */
function buildFilterChipOptions(
  members: ReadonlyArray<{ display_name: string }>
): ReadonlyArray<FilterMemberOption> {
  const FAMILY = 'Family'
  const options: FilterMemberOption[] = [{ value: FAMILY, label: FAMILY }]
  const covered = new Set<string>([FAMILY])
  for (const m of members) {
    const name = m.display_name
    if (name.length === 0) continue
    if (covered.has(name)) continue
    options.push({ value: name, label: name })
    covered.add(name)
  }
  return options
}

interface MemberFilterChipProps {
  value: string | null
  options: ReadonlyArray<FilterMemberOption>
  onChange: (next: string | undefined) => void
}

function MemberFilterChip({ value, options, onChange }: MemberFilterChipProps) {
  // Set state: rendered as "Member: <value> ✕" with a clear button.
  if (value) {
    return (
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label={`Clear member filter (${value})`}
        className={cn(
          'inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs',
          'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
        )}
      >
        <span className="font-medium">member:</span>
        <span>{value}</span>
        <X size={12} className="ml-1" />
      </button>
    )
  }

  // Unset state: rendered as "Member ▼" with a dropdown.
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Filter by member"
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-2 py-1 rounded-full text-xs',
            'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
          )}
        >
          <span className="font-medium">Member</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[180px] rounded-lg bg-surface border border-rule shadow-lg p-1',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0'
          )}
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">No members</div>
          ) : (
            options.map(o => (
              <DropdownMenu.Item
                key={o.value}
                onSelect={() => onChange(o.value)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
              >
                {o.label}
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function FilterChips({ filters, onChange, onOpenSheet, className }: FilterChipsProps) {
  const chips = chipsFor(filters)
  const membersQ = useHouseholdMembersList()
  const memberOptions = buildFilterChipOptions(membersQ.data ?? [])

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

  function setMember(value: string | undefined) {
    if (value === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { member, ...rest } = filters
      onChange(rest)
    } else {
      onChange({ ...filters, member: value })
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

      <MemberFilterChip
        value={filters.member ?? null}
        options={memberOptions}
        onChange={setMember}
      />

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
