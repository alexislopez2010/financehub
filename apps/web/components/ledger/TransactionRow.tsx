'use client'

import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'
import { EditableCell, type SelectOption } from './EditableCell'
import { RowActionsMenu } from './RowActionsMenu'

export type TransactionRow = Tables<'transactions'>

export interface TransactionRowProps {
  tx: TransactionRow
  selected?: boolean
  onSelectChange?: (selected: boolean) => void
  /** Categories for the inline category select. Required for category edit. */
  categoryOptions?: ReadonlyArray<SelectOption>
  onEditDescription?: (next: string) => void
  onEditAmount?: (next: number) => void
  onEditCategory?: (next: string) => void
  onPromote?: () => void
  onDelete?: () => void
  /** Opens the Convert-to-transfer dialog. Wired only for non-Transfer unpaired rows. */
  onConvertToTransfer?: () => void
  /** Calls the unpair RPC. Wired only for already-paired rows. */
  onUnpairTransfer?: () => void
  /** Disables the unpair item + shows "Unpairing…" inline. */
  unpairing?: boolean
}

const typeAmountTone: Record<string, string> = {
  Income: 'text-emerald-600',
  Refund: 'text-emerald-600',
  Expense: 'text-red-600',
  Transfer: 'text-muted'
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDay(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}`
}

export function TransactionRow({
  tx,
  selected,
  onSelectChange,
  categoryOptions,
  onEditDescription,
  onEditAmount,
  onEditCategory,
  onPromote,
  onDelete,
  onConvertToTransfer,
  onUnpairTransfer,
  unpairing
}: TransactionRowProps) {
  const tone = typeAmountTone[tx.type] ?? 'text-ink'
  const sign = tx.type === 'Income' || tx.type === 'Refund' ? '+' : tx.type === 'Expense' ? '−' : ''
  const showCheckbox = onSelectChange !== undefined
  const showActions = onPromote !== undefined || onDelete !== undefined

  const canConvert = tx.type !== 'Transfer' && tx.transfer_pair_id == null
  const canUnpair = tx.transfer_pair_id != null

  // Build the grid template classes based on which optional columns are present.
  // Using hardcoded Tailwind variants so JIT can pick them up at build time.
  const colCls = cn(
    showCheckbox && showActions
      ? 'grid-cols-[20px_60px_1fr_100px_28px] sm:grid-cols-[20px_60px_1fr_140px_120px_120px_28px]'
      : showCheckbox
        ? 'grid-cols-[20px_60px_1fr_100px] sm:grid-cols-[20px_60px_1fr_140px_120px_120px]'
        : showActions
          ? 'grid-cols-[60px_1fr_100px_28px] sm:grid-cols-[60px_1fr_140px_120px_120px_28px]'
          : 'grid-cols-[60px_1fr_100px] sm:grid-cols-[60px_1fr_140px_120px_120px]'
  )

  return (
    <div className={cn(
      'grid gap-3 items-center px-4 py-2.5 text-sm transition-colors',
      colCls,
      selected ? 'bg-blue-50' : 'hover:bg-gray-50'
    )}>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={e => onSelectChange?.(e.target.checked)}
          aria-label={`Select transaction ${tx.description}`}
          className="w-4 h-4 accent-brand cursor-pointer"
        />
      )}

      <div className="text-xs text-muted tabular">{formatDay(tx.date)}</div>

      <div className="text-ink truncate">
        {onEditDescription ? (
          <EditableCell
            variant="text"
            value={tx.description ?? ''}
            onCommit={onEditDescription}
          />
        ) : (
          <span title={tx.description ?? undefined}>{tx.description}</span>
        )}
      </div>

      <div className="hidden sm:block">
        {onEditCategory && categoryOptions ? (
          <EditableCell
            variant="select"
            value={tx.category_id ?? ''}
            options={[{ value: '', label: '(uncategorized)' }, ...categoryOptions]}
            onCommit={onEditCategory}
            display={
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs',
                'bg-gray-100 text-gray-700'
              )}>
                {tx.category ?? 'Uncategorized'}
              </span>
            }
          />
        ) : (
          tx.category && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-xs',
              'bg-gray-100 text-gray-700'
            )}>{tx.category}</span>
          )
        )}
      </div>

      <div className="hidden sm:block text-xs text-muted truncate" title={tx.account ?? ''}>
        {tx.account ?? ''}
      </div>

      <div className={cn('text-right tabular font-medium', tone)}>
        {onEditAmount ? (
          <EditableCell
            variant="number"
            value={Math.abs(tx.amount)}
            onCommit={n => onEditAmount(n)}
            display={<span>{sign}{formatUSD(Math.abs(tx.amount))}</span>}
            inputClassName="text-right"
          />
        ) : (
          <span>{sign}{formatUSD(Math.abs(tx.amount))}</span>
        )}
      </div>

      {showActions && (
        <div className="text-right">
          <RowActionsMenu
            onPromote={() => onPromote?.()}
            onDelete={() => onDelete?.()}
            {...(canConvert && onConvertToTransfer ? { onConvertToTransfer } : {})}
            {...(canUnpair && onUnpairTransfer ? { onUnpairTransfer } : {})}
            {...(unpairing !== undefined ? { unpairing } : {})}
          />
        </div>
      )}
    </div>
  )
}
