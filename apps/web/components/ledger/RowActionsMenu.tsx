'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical, ArrowRightCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface RowActionsMenuProps {
  onPromote: () => void
  onDelete: () => void
}

export function RowActionsMenu({ onPromote, onDelete }: RowActionsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Row actions"
          className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100"
        >
          <MoreVertical size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[180px] rounded-lg bg-surface border border-rule shadow-lg p-1',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0'
          )}
        >
          <DropdownMenu.Item
            onSelect={onPromote}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
          >
            <ArrowRightCircle size={14} className="text-brand" />
            Promote to bill
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded cursor-pointer hover:bg-red-50 outline-none"
          >
            <Trash2 size={14} />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
