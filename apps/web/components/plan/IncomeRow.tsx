'use client'

import { Trash2 } from 'lucide-react'
import { EditableCell } from '@/components/ledger/EditableCell'
import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'

type IncomePlanRow = Tables<'income_plan'>

export interface IncomeRowProps {
  plan: IncomePlanRow
  /** Sum of actual matched Income transactions for this source (aggregated across members). */
  matchedActual: number
  onEditAmount: (next: number) => void
  onDelete: () => void
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function pct(actual: number, planned: number): number {
  if (planned === 0) return 0
  return (actual / planned) * 100
}

export function IncomeRow({ plan, matchedActual, onEditAmount, onDelete }: IncomeRowProps) {
  const planned = plan.expected_amount
  const variance = matchedActual - planned
  const barPct = Math.min(100, Math.max(0, pct(matchedActual, planned)))

  return (
    <div className={cn(
      'grid grid-cols-[1fr_100px_100px_120px_28px] sm:grid-cols-[1fr_120px_120px_140px_28px] gap-3 items-center',
      'px-4 py-3 text-sm transition-colors hover:bg-gray-50'
    )}>
      <div className="min-w-0">
        <div className="text-ink font-medium truncate">{plan.source}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {plan.member && (
            <span className="text-xs text-muted">{plan.member}</span>
          )}
          <span className="text-xs text-muted/60">·</span>
          <span className="text-xs text-muted capitalize">{plan.frequency.toLowerCase()}</span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              matchedActual >= planned ? 'bg-emerald-500' : 'bg-amber-400'
            )}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <div className="text-right tabular text-sm">
        <EditableCell
          variant="number"
          value={planned}
          onCommit={onEditAmount}
          display={<span className="text-ink font-medium">{formatUSD(planned)}</span>}
          inputClassName="text-right"
        />
      </div>

      <div className="text-right tabular text-sm text-ink font-medium">
        {formatUSD(matchedActual)}
      </div>

      <div className={cn(
        'text-right tabular text-sm font-semibold',
        variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-600' : 'text-muted'
      )}>
        {variance > 0 ? '+' : variance < 0 ? '−' : ''}
        {formatUSD(Math.abs(variance))}
      </div>

      <div className="text-right">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete income plan for ${plan.source}`}
          className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
