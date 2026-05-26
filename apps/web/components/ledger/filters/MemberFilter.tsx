'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { useHouseholdMembersList } from '@/lib/data/householdMembers'
import { cn } from '@/lib/cn'

export interface MemberFilterProps {
  /**
   * undefined → filter not set
   * null      → explicitly filter to rows with no member assigned
   * string    → filter to that member name (or 'Family' synthetic)
   */
  value: string | null | undefined
  onChange: (next: string | null | undefined) => void
}

interface FilterMemberOption {
  /** Non-null string value to write into the filter. */
  value: string
  label: string
}

/**
 * Build the named-member option list for the Member filter chip. The
 * '(Unassigned)' option is rendered separately so it always appears first.
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

const UNASSIGNED_LABEL = '(Unassigned)'

export function MemberFilter({ value, onChange }: MemberFilterProps) {
  const membersQ = useHouseholdMembersList()
  const options = buildFilterChipOptions(membersQ.data ?? [])

  if (value !== undefined) {
    const display = value === null ? UNASSIGNED_LABEL : value
    return (
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label={`Clear member filter (${display})`}
        className={cn(
          'inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs',
          'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
        )}
      >
        <span className="font-medium">member:</span>
        <span>{display}</span>
        <X size={12} className="ml-1" />
      </button>
    )
  }

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
          <DropdownMenu.Item
            onSelect={() => onChange(null)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none italic"
          >
            {UNASSIGNED_LABEL}
          </DropdownMenu.Item>

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
