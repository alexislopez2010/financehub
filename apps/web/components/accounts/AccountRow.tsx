'use client'

import { Trash2 } from 'lucide-react'
import type { AccountBalance } from '@/lib/accounts/balances'
import { EditableCell } from '@/components/ledger/EditableCell'
import { cn } from '@/lib/cn'

const TYPE_TONES: Record<string, string> = {
  checking:   'bg-blue-50 text-blue-700',
  savings:    'bg-emerald-50 text-emerald-700',
  credit:     'bg-red-50 text-red-700',
  loan:       'bg-amber-50 text-amber-700',
  investment: 'bg-purple-50 text-purple-700'
}

const DEBT_TYPES = new Set(['credit', 'loan'])

export interface AccountRowProps {
  balance: AccountBalance
  onEditName?: (next: string) => void
  onArchive?: () => void
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function AccountRow({ balance, onEditName, onArchive }: AccountRowProps) {
  const isDebt = balance.type ? DEBT_TYPES.has(balance.type) : false
  const tone = isDebt
    ? balance.currentBalance > 0 ? 'text-red-600' : 'text-emerald-600'
    : balance.currentBalance < 0 ? 'text-red-600' : 'text-ink'

  return (
    <div className={cn(
      'grid grid-cols-[1fr_100px_120px_28px] sm:grid-cols-[1fr_120px_140px_28px] gap-3 items-center',
      'px-4 py-3 text-sm hover:bg-gray-50 transition-colors'
    )}>
      <div className="min-w-0">
        {onEditName ? (
          <EditableCell
            variant="text"
            value={balance.name}
            onCommit={onEditName}
            display={<span className="text-ink font-medium truncate block">{balance.name}</span>}
          />
        ) : (
          <div className="text-ink font-medium truncate">{balance.name}</div>
        )}
        {balance.type && (
          <span className={cn(
            'inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium',
            TYPE_TONES[balance.type] ?? 'bg-gray-100 text-gray-700'
          )}>
            {balance.type}
          </span>
        )}
      </div>

      <div className="hidden sm:block text-xs text-muted tabular text-right">
        {balance.txCount} {balance.txCount === 1 ? 'tx' : 'txs'}
      </div>

      <div className={cn('text-right tabular text-sm font-semibold', tone)}>
        {formatUSD(balance.currentBalance)}
      </div>

      <div className="text-right">
        {onArchive && (
          <button
            type="button"
            onClick={onArchive}
            aria-label={`Archive account ${balance.name}`}
            className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
