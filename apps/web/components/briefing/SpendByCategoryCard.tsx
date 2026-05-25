'use client'

import { PieChart } from 'lucide-react'
import type { CategorySpendRow } from '@/lib/briefing/spendByCategory'
import { cn } from '@/lib/cn'

export interface SpendByCategoryCardProps {
  rows: ReadonlyArray<CategorySpendRow>
  className?: string
}

interface MoMDisplay {
  label: string
  tone: 'positive' | 'negative' | 'neutral'
}

const NAME_TRUNCATE = 24

export function SpendByCategoryCard({ rows, className }: SpendByCategoryCardProps) {
  return (
    <section
      className={cn(
        'bg-surface border border-rule rounded-xl p-5 shadow-sm',
        className
      )}
    >
      <header className="flex items-baseline justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
            <PieChart size={16} strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-ink">Spend by Category</h2>
        </div>
        <span className="text-xs text-muted">This month</span>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-muted italic">No expense transactions this month yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(row => {
            const mom = formatMoM(row.monthOverMonth)
            const barPct = Math.min(Math.max(row.shareOfTotal, 0), 1) * 100
            return (
              <li
                key={row.category}
                className="grid grid-cols-[40%_35%_25%] items-center gap-3"
              >
                <span
                  className="text-sm text-ink truncate"
                  title={row.category}
                >
                  {truncate(row.category, NAME_TRUNCATE)}
                </span>
                <div
                  className="bg-rule h-1.5 rounded-full overflow-hidden"
                  aria-hidden="true"
                >
                  <div
                    className="bg-brand h-full rounded-full"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="text-right text-sm tabular-nums flex items-baseline justify-end gap-1.5">
                  <span className="text-ink font-medium">{formatUSD(row.amount)}</span>
                  <span
                    className={cn('text-[11px]', momToneClass(mom.tone))}
                    aria-label={`Month over month ${mom.label}`}
                  >
                    {mom.label}
                  </span>
                </div>
              </li>
            )
          })}
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

function formatMoM(mom: number | null): MoMDisplay {
  if (mom === null) return { label: '—', tone: 'neutral' }
  if (mom === 0) return { label: '—', tone: 'neutral' }
  const pct = Math.round(Math.abs(mom) * 100)
  if (mom > 0) return { label: `▲ ${pct}%`, tone: 'positive' }
  return { label: `▼ ${pct}%`, tone: 'negative' }
}

function momToneClass(tone: MoMDisplay['tone']): string {
  // For spend, MoM up = bad (red), down = good (emerald)
  if (tone === 'positive') return 'text-red-600'
  if (tone === 'negative') return 'text-emerald-600'
  return 'text-muted'
}
