'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  MoreVertical,
  ArrowRightCircle,
  ArrowRightLeft,
  Trash2,
  Unlink,
  TrendingDown,
  TrendingUp,
  Undo2
} from 'lucide-react'
import { cn } from '@/lib/cn'

export type DemoteTransferTarget = 'Expense' | 'Income' | 'Refund'

export interface RowActionsMenuProps {
  onPromote: () => void
  onDelete: () => void
  /** When set, shows a "Convert to transfer" item (non-Transfer rows). */
  onConvertToTransfer?: () => void
  /**
   * When set, shows a "Pair with another transaction" item (orphan Transfer
   * rows — type === 'Transfer' && transfer_pair_id == null). Opens the same
   * dialog as Convert; the underlying RPC doesn't care about current type.
   */
  onPairTransfer?: () => void
  /** When set, shows an "Unpair transfer" item. */
  onUnpairTransfer?: () => void
  /**
   * When set, shows "Change to expense / income / refund" items, skipping
   * the row's current type. Intended for any unpaired row so misclassified
   * Income/Expense/Refund/Transfer rows can be retyped from the menu.
   */
  onDemoteToType?: (next: DemoteTransferTarget) => void
  /**
   * Current row type. When provided alongside `onDemoteToType`, the matching
   * "Change to X" item is omitted (since "change to current type" is a no-op).
   */
  currentType?: 'Income' | 'Expense' | 'Transfer' | 'Refund'
  /** When true, shows "Unpairing…" inline on the unpair item and disables it. */
  unpairing?: boolean
}

const itemBase =
  'flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none'

export function RowActionsMenu({
  onPromote,
  onDelete,
  onConvertToTransfer,
  onPairTransfer,
  onUnpairTransfer,
  onDemoteToType,
  currentType,
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
            'z-50 min-w-[220px] rounded-lg bg-surface border border-rule shadow-lg p-1',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0'
          )}
        >
          <DropdownMenu.Item onSelect={onPromote} className={itemBase}>
            <ArrowRightCircle size={14} className="text-brand" />
            Promote to bill
          </DropdownMenu.Item>

          {onConvertToTransfer && (
            <DropdownMenu.Item onSelect={onConvertToTransfer} className={itemBase}>
              <ArrowRightLeft size={14} className="text-brand" />
              Convert to transfer
            </DropdownMenu.Item>
          )}

          {onPairTransfer && (
            <DropdownMenu.Item onSelect={onPairTransfer} className={itemBase}>
              <ArrowRightLeft size={14} className="text-brand" />
              Pair with another transaction
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

          {onDemoteToType && (
            <>
              {currentType !== 'Expense' && (
                <DropdownMenu.Item
                  onSelect={() => onDemoteToType('Expense')}
                  className={itemBase}
                >
                  <TrendingDown size={14} className="text-red-600" />
                  Change to expense
                </DropdownMenu.Item>
              )}
              {currentType !== 'Income' && (
                <DropdownMenu.Item
                  onSelect={() => onDemoteToType('Income')}
                  className={itemBase}
                >
                  <TrendingUp size={14} className="text-emerald-600" />
                  Change to income
                </DropdownMenu.Item>
              )}
              {currentType !== 'Refund' && (
                <DropdownMenu.Item
                  onSelect={() => onDemoteToType('Refund')}
                  className={itemBase}
                >
                  <Undo2 size={14} className="text-emerald-600" />
                  Change to refund
                </DropdownMenu.Item>
              )}
            </>
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
