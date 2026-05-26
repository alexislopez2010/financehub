'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical, ArrowRightCircle, ArrowRightLeft, Trash2, Unlink } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface RowActionsMenuProps {
  onPromote: () => void
  onDelete: () => void
  /** When set, shows a "Convert to transfer" item. */
  onConvertToTransfer?: () => void
  /** When set, shows an "Unpair transfer" item. */
  onUnpairTransfer?: () => void
  /** When true, shows "Unpairing…" inline on the unpair item and disables it. */
  unpairing?: boolean
}

export function RowActionsMenu({
  onPromote,
  onDelete,
  onConvertToTransfer,
  onUnpairTransfer,
  unpairing
}: RowActionsMenuProps) {
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
            'z-50 min-w-[200px] rounded-lg bg-surface border border-rule shadow-lg p-1',
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

          {onConvertToTransfer && (
            <DropdownMenu.Item
              onSelect={onConvertToTransfer}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
            >
              <ArrowRightLeft size={14} className="text-brand" />
              Convert to transfer
            </DropdownMenu.Item>
          )}

          {onUnpairTransfer && (
            <DropdownMenu.Item
              onSelect={event => {
                if (unpairing) {
                  event.preventDefault()
                  return
                }
                onUnpairTransfer()
              }}
              disabled={unpairing ?? false}
              className={cn(
                'flex items-center gap-2 px-3 py-2 text-sm rounded outline-none',
                unpairing
                  ? 'text-muted cursor-not-allowed'
                  : 'text-ink cursor-pointer hover:bg-gray-100'
              )}
            >
              <Unlink size={14} className="text-muted" />
              {unpairing ? 'Unpairing…' : 'Unpair transfer'}
            </DropdownMenu.Item>
          )}

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
