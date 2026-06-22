'use client'

import { X } from 'lucide-react'
import type { BillProjection, ProjectionMethod } from '@/lib/forecast/project'
import { isSpendTier, type SpendTier } from '@/lib/forecast/tier'
import { TIER_THEME, TIER_ORDER } from '@/lib/forecast/tierTheme'

const METHOD_LABEL: Record<ProjectionMethod, string> = {
  'seasonal-profile': 'Seasonal',
  'ledger-seasonal': 'Ledger avg',
  'flat': 'Flat',
  'trailing-avg': 'Trailing avg'
}

const METHOD_HINT: Record<ProjectionMethod, string> = {
  'seasonal-profile': "From this bill's imported seasonal history.",
  'ledger-seasonal': 'Calendar-month average from your ledger history.',
  'flat': "The bill's flat budget amount.",
  'trailing-avg': 'Trailing 6-month average of this category.'
}

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export interface ForecastBillRowProps {
  projection: BillProjection
  /** Projected spend for the focus month (the first projected month). */
  monthlyAmount: number
  /** Total projected across the whole horizon. */
  horizonTotal: number
  onChangeTier: (tier: SpendTier) => void
  /** Removes this line from the forecast (persists exclude_from_forecast). */
  onRemove: () => void
  busy?: boolean
}

/**
 * One projected line (a bill or a discretionary category) inside a tier group.
 * The tier chip is a `select` so the user can re-assign the tier with one
 * action — the override persists to the bill (or category) and the projection
 * re-resolves.
 */
export function ForecastBillRow({ projection, monthlyAmount, horizonTotal, onChangeTier, onRemove, busy }: ForecastBillRowProps) {
  const theme = TIER_THEME[projection.tier]
  return (
    <div className="group flex items-center gap-3 py-2 border-b border-rule last:border-0">
      {/* Tier swatch + override */}
      <select
        aria-label={`Spend tier for ${projection.billName}`}
        value={projection.tier}
        disabled={busy}
        onChange={e => { if (isSpendTier(e.target.value)) onChangeTier(e.target.value) }}
        className={`shrink-0 rounded-md border border-rule bg-surface px-1.5 py-1 text-[11px] font-medium ${theme.text} disabled:opacity-50`}
      >
        {TIER_ORDER.map(t => (
          <option key={t} value={t}>{TIER_THEME[t].label}</option>
        ))}
      </select>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{projection.billName}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted">
          <span title={METHOD_HINT[projection.method]} className="rounded bg-gray-100 px-1 py-0.5">
            {METHOD_LABEL[projection.method]}
          </span>
          {projection.category && <span className="truncate">{projection.category}</span>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums text-ink">{fmtUSD(monthlyAmount)}<span className="text-[11px] font-normal text-muted">/mo</span></div>
        <div className="text-[11px] tabular-nums text-muted">{fmtUSD(horizonTotal)} total</div>
      </div>

      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={`Remove ${projection.billName} from the forecast`}
        title="Remove from forecast"
        className="shrink-0 rounded-md p-1 text-muted opacity-60 hover:bg-red-50 hover:text-red-600 hover:opacity-100 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-60"
      >
        <X size={15} />
      </button>
    </div>
  )
}
