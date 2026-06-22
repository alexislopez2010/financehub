'use client'

import { TIER_THEME, TIER_ORDER } from '@/lib/forecast/tierTheme'

export interface ForecastMonthBar {
  year: number
  month: number      // 1..12
  essential: number
  services: number
  discretionary: number
}

export interface ForecastTierChartProps {
  data: ReadonlyArray<ForecastMonthBar>
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function fmtUSD0(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/**
 * Stacked bar chart of projected monthly spend by tier across the horizon.
 * Hand-rolled SVG (matches the existing ForecastChart approach — no chart lib).
 * Scrolls horizontally on narrow screens so long horizons don't squash.
 */
export function ForecastTierChart({ data }: ForecastTierChartProps) {
  if (data.length === 0) {
    return <div className="text-sm text-muted py-6 text-center">No projection data.</div>
  }

  // Geometry.
  const barW = 28
  const gap = 14
  const padL = 8
  const padR = 8
  const chartH = 180
  const labelH = 22
  const width = padL + padR + data.length * barW + (data.length - 1) * gap
  const totals = data.map(d => d.essential + d.services + d.discretionary)
  const maxTotal = Math.max(1, ...totals)
  const yScale = (v: number) => (v / maxTotal) * chartH

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        {TIER_ORDER.map(t => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${TIER_THEME[t].fill}`} aria-hidden="true" />
            <span className="text-muted">{TIER_THEME[t].label}</span>
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg
          width={Math.max(width, 320)}
          height={chartH + labelH}
          role="img"
          aria-label="Projected monthly spend by tier"
          className="block"
        >
          {data.map((d, i) => {
            const x = padL + i * (barW + gap)
            const eH = yScale(d.essential)
            const sH = yScale(d.services)
            const dH = yScale(d.discretionary)
            // Stack from the baseline up: essential, then services, then discretionary.
            const eY = chartH - eH
            const sY = eY - sH
            const dY = sY - dH
            const isJan = d.month === 1
            const monthLabel = MONTHS[d.month - 1]!
            return (
              <g key={`${d.year}-${d.month}`}>
                <title>{`${monthLabel} ${d.year}: ${fmtUSD0(totals[i]!)}`}</title>
                <rect x={x} y={eY} width={barW} height={eH} fill={TIER_THEME.essential.hex} />
                <rect x={x} y={sY} width={barW} height={sH} fill={TIER_THEME.services.hex} />
                <rect x={x} y={dY} width={barW} height={dH} fill={TIER_THEME.discretionary.hex} />
                <text
                  x={x + barW / 2}
                  y={chartH + 14}
                  textAnchor="middle"
                  className="fill-muted"
                  style={{ fontSize: 9 }}
                >
                  {MONTHS[d.month - 1]}
                  {isJan ? ` '${String(d.year).slice(2)}` : ''}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
