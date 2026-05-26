'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { useAccounts } from '@/lib/data/accounts'
import { cn } from '@/lib/cn'

export interface AccountFilterProps {
  value: string | undefined
  onChange: (next: string | undefined) => void
}

export function AccountFilter({ value, onChange }: AccountFilterProps) {
  const accountsQ = useAccounts()
  const accounts = accountsQ.data ?? []

  if (value) {
    return (
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label={`Clear account filter (${value})`}
        className={cn(
          'inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs',
          'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
        )}
      >
        <span className="font-medium">account:</span>
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
          aria-label="Filter by account"
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-2 py-1 rounded-full text-xs',
            'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
          )}
        >
          <span className="font-medium">Account</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[200px] max-h-[320px] overflow-y-auto rounded-lg bg-surface border border-rule shadow-lg p-1',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0'
          )}
        >
          {accounts.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">No accounts</div>
          ) : (
            accounts.map(a => (
              <DropdownMenu.Item
                key={a.id}
                onSelect={() => onChange(a.name)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
              >
                {a.name}
              </DropdownMenu.Item>
            ))
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
