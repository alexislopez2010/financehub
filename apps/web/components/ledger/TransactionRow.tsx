'use client'

import type { Tables } from '@/lib/supabase/database.types'
import { ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/cn'
import { EditableCell, type SelectOption } from './EditableCell'
import { RowActionsMenu, type DemoteTransferTarget } from './RowActionsMenu'
import { buildMemberOptions, type MemberOption } from '@/lib/ledger/memberOptions'
import { signedActivity } from '@/lib/finance/signedActivity'

export type TransactionRow = Tables<'transactions'>

export interface TransactionRowProps {
  tx: TransactionRow
  selected?: boolean
  onSelectChange?: (selected: boolean) => void
  /** Categories for the inline category select. Required for category edit. */
  categoryOptions?: ReadonlyArray<SelectOption>
  /**
   * Household member roster used by the inline Member select. When omitted,
   * the cell renders read-only. The list should already be sorted by
   * display_name (the `useHouseholdMembersList` hook does this).
   */
  members?: ReadonlyArray<{ display_name: string }>
  onEditDescription?: (next: string) => void
  onEditAmount?: (next: number) => void
  onEditCategory?: (next: string) => void
  /** Commit handler for the Member field. `next` is null for '(Unassigned)'. */
  onEditMember?: (next: string | null) => void
  onPromote?: () => void
  onDelete?: () => void
  /** Opens the Convert-to-transfer dialog. Wired only for non-Transfer unpaired rows. */
  onConvertToTransfer?: () => void
  /**
   * Opens the same pairing dialog for orphan Transfer rows
   * (type === 'Transfer' && transfer_pair_id == null).
   */
  onPairTransfer?: () => void
  /** Calls the unpair RPC. Wired only for already-paired rows. */
  onUnpairTransfer?: () => void
  /**
   * Demote an orphan Transfer to a non-Transfer type. Wired only for
   * `type === 'Transfer' && transfer_pair_id == null` rows.
   */
  onDemoteTransfer?: (next: DemoteTransferTarget) => void
  /** Disables the unpair item + shows "Unpairing…" inline. */
  unpairing?: boolean
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDay(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}`
}

// Sentinel value used in the select to represent `null` (unassigned),
// since <select> can only carry string values. Decoded on commit.
const UNASSIGNED_SENTINEL = '__unassigned__'

function toSelectOption(o: MemberOption): SelectOption {
  return { value: o.value ?? UNASSIGNED_SENTINEL, label: o.label }
}

type TypePillKind = 'Income' | 'Refund' | 'Transfer'

const TYPE_PILL_TONES: Record<TypePillKind, string> = {
  Income: 'bg-emerald-50 text-emerald-700',
  Refund: 'bg-blue-50 text-blue-700',
  Transfer: 'bg-purple-50 text-purple-700'
}

function TypePill({ type }: { type: TypePillKind }) {
  return (
    <span
      className={cn(
        'inline-block ml-1.5 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium align-middle',
        TYPE_PILL_TONES[type]
      )}
    >
      {type}
    </span>
  )
}

export function TransactionRow({
  tx,
  selected,
  onSelectChange,
  categoryOptions,
  members,
  onEditDescription,
  onEditAmount,
  onEditCategory,
  onEditMember,
  onPromote,
  onDelete,
  onConvertToTransfer,
  onPairTransfer,
  onUnpairTransfer,
  onDemoteTransfer,
  unpairing
}: TransactionRowProps) {
  // Tone is by SIGNED activity (resolves legacy positive-magnitude Expenses
  // into the proper -value) so the row color always reflects true direction.
  // Transfer rows still get red/green via the raw signed amount.
  const signed = signedActivity(tx)
  const tone = signed < 0 ? 'text-red-600' : signed > 0 ? 'text-emerald-600' : 'text-ink'
  const sign = signed < 0 ? '−' : signed > 0 ? '+' : ''
  const showCheckbox = onSelectChange !== undefined
  const showActions = onPromote !== undefined || onDelete !== undefined

  const isOrphanTransfer = tx.type === 'Transfer' && tx.transfer_pair_id == null
  const canConvert = tx.type !== 'Transfer' && tx.transfer_pair_id == null
  const canPair = isOrphanTransfer
  const canUnpair = tx.transfer_pair_id != null
  // "Change to X" applies to any row whose type isn't fixed by an active pair.
  // The matching item is skipped via currentType so we never offer a no-op.
  const canChangeType = tx.transfer_pair_id == null
  const knownType =
    tx.type === 'Income' || tx.type === 'Expense' || tx.type === 'Transfer' || tx.type === 'Refund'
      ? tx.type
      : undefined

  // Build the grid template classes based on which optional columns are present.
  // Using hardcoded Tailwind variants so JIT can pick them up at build time.
  // Desktop layout: date | description | category | account | member | amount [| actions]
  // Mobile: date | description | amount [| actions]  (member hidden on small screens)
  const colCls = cn(
    showCheckbox && showActions
      ? 'grid-cols-[20px_60px_1fr_100px_28px] sm:grid-cols-[20px_60px_1fr_140px_120px_120px_120px_28px]'
      : showCheckbox
        ? 'grid-cols-[20px_60px_1fr_100px] sm:grid-cols-[20px_60px_1fr_140px_120px_120px_120px]'
        : showActions
          ? 'grid-cols-[60px_1fr_100px_28px] sm:grid-cols-[60px_1fr_140px_120px_120px_120px_28px]'
          : 'grid-cols-[60px_1fr_100px] sm:grid-cols-[60px_1fr_140px_120px_120px_120px]'
  )

  // Build member dropdown options. The current row's member value is passed
  // as a legacyValue so the dropdown always has a matching option even if
  // the name is no longer in the current household_members roster.
  const memberOptions = members
    ? buildMemberOptions(
        members,
        tx.member !== null && tx.member !== undefined ? [tx.member] : []
      ).map(toSelectOption)
    : undefined

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
        {tx.type === 'Transfer' && (
          <ArrowRightLeft
            size={12}
            className="inline-block ml-1.5 text-muted align-text-bottom"
            aria-label="Transfer"
          />
        )}
      </div>

      <div className="hidden sm:flex sm:items-center sm:min-w-0">
        {(() => {
          // Transfers don't have a meaningful spending category — they're
          // money moving between accounts, not spend. When the user hasn't
          // explicitly set a category, render nothing instead of the noisy
          // "Uncategorized" badge that sits next to the Transfer pill.
          // The dropdown still mounts so the user CAN categorize one if
          // they want (e.g., to tag mortgage principal payments).
          const isTransferWithNoCategory = tx.type === 'Transfer' && !tx.category
          if (onEditCategory && categoryOptions) {
            return (
              <EditableCell
                variant="select"
                value={tx.category_id ?? ''}
                options={[{ value: '', label: '(uncategorized)' }, ...categoryOptions]}
                onCommit={onEditCategory}
                display={
                  isTransferWithNoCategory ? (
                    <span className="text-muted text-xs">—</span>
                  ) : (
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-md text-xs',
                      'bg-gray-100 text-gray-700'
                    )}>
                      {tx.category ?? 'Uncategorized'}
                    </span>
                  )
                }
              />
            )
          }
          return tx.category && (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-xs',
              'bg-gray-100 text-gray-700'
            )}>{tx.category}</span>
          )
        })()}
        {tx.type === 'Income' || tx.type === 'Refund' || tx.type === 'Transfer' ? (
          <TypePill type={tx.type} />
        ) : null}
      </div>

      <div className="hidden sm:block text-xs text-muted truncate" title={tx.account ?? ''}>
        {tx.account ?? ''}
      </div>

      <div className="hidden sm:block text-xs truncate">
        {onEditMember && memberOptions ? (
          <EditableCell
            variant="select"
            value={tx.member ?? UNASSIGNED_SENTINEL}
            options={memberOptions}
            onCommit={v => onEditMember(v === UNASSIGNED_SENTINEL ? null : v)}
            display={
              tx.member ? (
                <span className="text-ink">{tx.member}</span>
              ) : (
                <span className="italic text-muted">Unassigned</span>
              )
            }
          />
        ) : tx.member ? (
          <span className="text-ink truncate" title={tx.member}>{tx.member}</span>
        ) : (
          <span className="italic text-muted">Unassigned</span>
        )}
      </div>

      <div className={cn('text-right tabular font-medium', tone)}>
        {onEditAmount ? (
          <EditableCell
            variant="number"
            value={Math.abs(tx.amount)}
            onCommit={n => onEditAmount(n)}
            display={<span>{sign}{formatUSD(Math.abs(signed))}</span>}
            inputClassName="text-right"
          />
        ) : (
          <span>{sign}{formatUSD(Math.abs(signed))}</span>
        )}
      </div>

      {showActions && (
        <div className="text-right">
          <RowActionsMenu
            onPromote={() => onPromote?.()}
            onDelete={() => onDelete?.()}
            {...(canConvert && onConvertToTransfer ? { onConvertToTransfer } : {})}
            {...(canPair && onPairTransfer ? { onPairTransfer } : {})}
            {...(canUnpair && onUnpairTransfer ? { onUnpairTransfer } : {})}
            {...(canChangeType && onDemoteTransfer
              ? {
                  onDemoteToType: onDemoteTransfer,
                  ...(knownType ? { currentType: knownType } : {})
                }
              : {})}
            {...(unpairing !== undefined ? { unpairing } : {})}
          />
        </div>
      )}
    </div>
  )
}
