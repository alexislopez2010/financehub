'use client'

import { Store } from 'lucide-react'
import type { MerchantSpendRow } from '@/lib/briefing/topMerchants'
import { cn } from '@/lib/cn'

export interface TopMerchantsCardProps {
  rows: ReadonlyArray<MerchantSpendRow>
  className?: string
}

const NAME_TRUNCATE = 28

export function TopMerchantsCard({ rows, className }: TopMerchantsCardProps) {
  return (
    <section
      className={cn(
        'bg-surface border border-rule rounded-xl p-5 shadow-sm',
        className
      )}
    >
      <header className="flex items-baseline justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600">
            <Store size={16} strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-ink">Top Merchants</h2>
        </div>
        <span className="text-xs text-muted">This month</span>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted italic">No merchant spend this month yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, i) => (
            <li
              key={row.merchant}
              className={cn(
                'flex items-baseline justify-between gap-3 py-1',
                i < rows.length - 1 && 'border-b border-dotted border-rule'
              )}
            >
              <span
                className="text-sm text-ink truncate"
                title={row.merchant}
              >
                {truncate(row.merchant, NAME_TRUNCATE)}
              </span>
              <span className="text-sm font-medium tabular-nums text-ink shrink-0">
                {formatUSD(row.amount)}{' '}
                <span className="text-xs text-muted font-normal">
                  ({row.count} tx)
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, Math.max(0, max - 1)) + '…'
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}
