'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export type TransactionType = 'Income' | 'Expense' | 'Transfer' | 'Refund'

const TYPES: ReadonlyArray<TransactionType> = ['Income', 'Expense', 'Transfer', 'Refund']

export interface TypeFilterProps {
  value: TransactionType | undefined
  onChange: (next: TransactionType | undefined) => void
}

export function TypeFilter({ value, onChange }: TypeFilterProps) {
  if (value) {
    return (
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label={`Clear type filter (${value})`}
        className={cn(
          'inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs',
          'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
        )}
      >
        <span className="font-medium">type:</span>
        <span>{value}</span>
        <X size={12} className="ml-1" />
      </button>
    )
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Filter by type"
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-2 py-1 rounded-full text-xs',
            'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
          )}
        >
          <span className="font-medium">Type</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[160px] rounded-lg bg-surface border border-rule shadow-lg p-1',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0'
          )}
        >
          {TYPES.map(t => (
            <DropdownMenu.Item
              key={t}
              onSelect={() => onChange(t)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
            >
              {t}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
