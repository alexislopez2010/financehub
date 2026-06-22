'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BillProjection } from '@/lib/forecast/project'
import type { SpendTier } from '@/lib/forecast/tier'
import { TIER_THEME } from '@/lib/forecast/tierTheme'
import { ForecastBillRow } from './ForecastBillRow'

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function monthAmount(p: BillProjection, year: number, month: number): number {
  return p.months.find(m => m.year === year && m.month === month)?.amount ?? 0
}

function horizonTotal(p: BillProjection): number {
  return p.months.reduce((sum, m) => sum + m.amount, 0)
}

export interface TierGroupProps {
  tier: SpendTier
  projections: ReadonlyArray<BillProjection>
  /** The focus month per-row amounts are shown for. */
  focusYear: number
  focusMonth: number
  onChangeTier: (projection: BillProjection, tier: SpendTier) => void
  pendingId?: string | null
}

/**
 * A collapsible, color-coded section for one spend tier. The header shows the
 * tier's projected total for the focus month; rows let the user re-classify a
 * line into another tier.
 */
export function TierGroup({ tier, projections, focusYear, focusMonth, onChangeTier, pendingId }: TierGroupProps) {
  const [open, setOpen] = useState(true)
  const theme = TIER_THEME[tier]
  const sorted = [...projections].sort(
    (a, b) => monthAmount(b, focusYear, focusMonth) - monthAmount(a, focusYear, focusMonth)
  )
  const tierTotal = sorted.reduce((sum, p) => sum + monthAmount(p, focusYear, focusMonth), 0)

  return (
    <section className={`rounded-xl border border-rule overflow-hidden ${theme.softBg}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        {open ? <ChevronDown className="size-4 text-muted" /> : <ChevronRight className="size-4 text-muted" />}
        <span className={`inline-block size-3 rounded-sm ${theme.fill}`} aria-hidden="true" />
        <span className={`text-sm font-semibold ${theme.text}`}>{theme.label}</span>
        <span className="ml-1 text-xs text-muted">
          {sorted.length} {sorted.length === 1 ? 'line' : 'lines'}
        </span>
        <span className="ml-auto text-sm font-semibold tabular-nums text-ink">
          {fmtUSD(tierTotal)}<span className="text-[11px] font-normal text-muted">/mo</span>
        </span>
      </button>

      {open && (
        <div className="bg-surface px-4 py-1">
          {sorted.length === 0 ? (
            <p className="py-3 text-sm text-muted">No lines in this tier.</p>
          ) : (
            sorted.map(p => (
              <ForecastBillRow
                key={p.billId}
                projection={p}
                monthlyAmount={monthAmount(p, focusYear, focusMonth)}
                horizonTotal={horizonTotal(p)}
                onChangeTier={t => onChangeTier(p, t)}
                busy={pendingId === p.billId}
              />
            ))
          )}
        </div>
      )}
    </section>
  )
}
