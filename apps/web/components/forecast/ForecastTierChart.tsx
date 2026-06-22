'use client'

import { useState, type MouseEvent } from 'react'
import { TIER_THEME, TIER_ORDER } from '@/lib/forecast/tierTheme'
import { cn } from '@/lib/cn'

export interface ForecastMonthBar {
  year: number
  month: number      // 1..12
  essential: number
  services: number
  discretionary: number
}

export interface ForecastTierChartProps {
  data: ReadonlyArray<ForecastMonthBar>
  /** Index of the month the line items are itemizing (gets a highlight). */
  selectedIndex?: number
  /** Click a bar to itemize that month below the chart. */
  onSelectMonth?: (index: number) => void
  /** Flat projected monthly income; draws a reference line. Omit/0 = no line. */
  incomeLine?: number
}

const INCOME_HEX = '#059669' // emerald — matches --color-accent

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function fmtUSD0(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtCompact(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 })
}

const CURSOR_OFFSET = 16

interface HoverState {
  idx: number
  /** Viewport coords — the tooltip is position: fixed. */
  x: number
  y: number
}

/**
 * Stacked bar chart of projected monthly spend by tier across the horizon.
 * Hand-rolled SVG. A left y-axis gives static reference values; hovering a
 * month reveals a floating tooltip with the per-tier breakdown and total.
 */
export function ForecastTierChart({ data, selectedIndex, onSelectMonth, incomeLine }: ForecastTierChartProps) {
  const [hover, setHover] = useState<HoverState | null>(null)

  if (data.length === 0) {
    return <div className="text-sm text-muted py-6 text-center">No projection data.</div>
  }

  const hasIncome = typeof incomeLine === 'number' && incomeLine > 0

  // Geometry.
  const barW = 30
  const gap = 14
  const padL = 8
  const padR = 8
  const chartH = 180
  const labelH = 22
  const width = padL + padR + data.length * barW + (data.length - 1) * gap
  const totals = data.map(d => d.essential + d.services + d.discretionary)
  // Include income so its line never falls off the top of the scale.
  const maxTotal = Math.max(1, hasIncome ? incomeLine! : 0, ...totals)
  const yScale = (v: number) => (v / maxTotal) * chartH
  const incomeY = hasIncome ? chartH - yScale(incomeLine!) : 0

  const ticks = [maxTotal, maxTotal / 2, 0]
  const hovered = hover ? data[hover.idx] : null
  const hoveredTotal = hover ? totals[hover.idx]! : 0

  function onMove(idx: number, e: MouseEvent<SVGRectElement>) {
    setHover({ idx, x: e.clientX, y: e.clientY })
  }

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
        {hasIncome && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-0 border-t-2 border-dashed" style={{ borderColor: INCOME_HEX }} aria-hidden="true" />
            <span className="text-muted">Income {fmtUSD0(incomeLine!)}/mo</span>
          </span>
        )}
      </div>

      <div className="flex items-start">
        {/* Y-axis gutter — stays fixed while the bars scroll. */}
        <div
          className="shrink-0 flex flex-col justify-between pr-2 text-right text-[10px] tabular-nums text-muted"
          style={{ height: chartH }}
          aria-hidden="true"
        >
          {ticks.map((t, i) => <span key={i}>{fmtCompact(t)}</span>)}
        </div>

        <div className="overflow-x-auto">
          <svg
            width={Math.max(width, 240)}
            height={chartH + labelH}
            role="img"
            aria-label="Projected monthly spend by tier"
            className="block"
          >
            {/* Horizontal gridlines at each tick. */}
            {ticks.map((t, i) => {
              const y = chartH - yScale(t)
              return (
                <line
                  key={`grid-${i}`}
                  x1={0}
                  x2={Math.max(width, 240)}
                  y1={y}
                  y2={y}
                  stroke="var(--color-rule)"
                  strokeWidth={1}
                  strokeDasharray={t === 0 ? undefined : '2 3'}
                />
              )
            })}

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
              const isHover = hover?.idx === i
              const isSelected = selectedIndex === i
              const highlight = isSelected ? 'var(--color-brand)' : isHover ? 'var(--color-ink)' : 'transparent'
              const highlightOpacity = isSelected ? 0.08 : isHover ? 0.05 : 0
              // Portion of the bar that pokes above the income line (deficit month).
              const overIncome = hasIncome && totals[i]! > incomeLine!
              return (
                <g key={`${d.year}-${d.month}`}>
                  <rect x={x} y={eY} width={barW} height={eH} fill={TIER_THEME.essential.hex} />
                  <rect x={x} y={sY} width={barW} height={sH} fill={TIER_THEME.services.hex} />
                  <rect x={x} y={dY} width={barW} height={dH} fill={TIER_THEME.discretionary.hex} />
                  {/* Red cap on spend above income. */}
                  {overIncome && (
                    <rect x={x} y={dY} width={barW} height={incomeY - dY} fill="var(--color-warn)" fillOpacity={0.28} />
                  )}
                  {/* Full-column hover/select target (also covers space above the bar). */}
                  <rect
                    x={x - gap / 2}
                    y={0}
                    width={barW + gap}
                    height={chartH}
                    fill={highlight}
                    fillOpacity={highlightOpacity}
                    onMouseMove={e => onMove(i, e)}
                    onMouseEnter={e => onMove(i, e)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => onSelectMonth?.(i)}
                    style={{ cursor: onSelectMonth ? 'pointer' : 'default' }}
                  />
                  {/* Selected-month underline. */}
                  {isSelected && (
                    <rect x={x} y={chartH + 1} width={barW} height={2} fill="var(--color-brand)" rx={1} />
                  )}
                  <text
                    x={x + barW / 2}
                    y={chartH + 14}
                    textAnchor="middle"
                    className={isSelected ? 'fill-brand' : 'fill-muted'}
                    style={{ fontSize: 9, fontWeight: isSelected ? 600 : 400 }}
                  >
                    {MONTHS[d.month - 1]!}
                    {isJan ? ` '${String(d.year).slice(2)}` : ''}
                  </text>
                </g>
              )
            })}

            {/* Projected monthly income — drawn on top, non-interactive. */}
            {hasIncome && (
              <g style={{ pointerEvents: 'none' }}>
                <line
                  x1={0}
                  x2={Math.max(width, 240)}
                  y1={incomeY}
                  y2={incomeY}
                  stroke={INCOME_HEX}
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                />
                <text x={2} y={Math.max(9, incomeY - 3)} style={{ fontSize: 9, fontWeight: 600 }} fill={INCOME_HEX}>
                  Income
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Floating tooltip — fixed so it never clips inside the scroll container. */}
      {hover && hovered && (
        <TierTooltip bar={hovered} total={hoveredTotal} income={hasIncome ? incomeLine! : null} x={hover.x} y={hover.y} />
      )}
    </div>
  )
}

function TierTooltip({ bar, total, income, x, y }: { bar: ForecastMonthBar; total: number; income: number | null; x: number; y: number }) {
  const flipLeft = typeof window !== 'undefined' && x > window.innerWidth - 220
  const rows: ReadonlyArray<{ key: typeof TIER_ORDER[number]; amount: number }> = [
    { key: 'essential', amount: bar.essential },
    { key: 'services', amount: bar.services },
    { key: 'discretionary', amount: bar.discretionary }
  ]
  const net = income !== null ? income - total : null
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed z-50 whitespace-nowrap rounded-lg px-3 py-2',
        'bg-white text-gray-900 border border-gray-300 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.25)]'
      )}
      style={{
        top: y,
        left: flipLeft ? x - CURSOR_OFFSET : x + CURSOR_OFFSET,
        transform: flipLeft ? 'translate(-100%, -50%)' : 'translate(0, -50%)'
      }}
    >
      <div className="text-[11px] font-medium text-gray-500">{MONTHS[bar.month - 1]!} {bar.year}</div>
      <div className="text-base font-semibold tabular-nums text-gray-900">{fmtUSD0(total)}</div>
      <div className="mt-1.5 space-y-0.5 border-t border-gray-200 pt-1.5 text-[11px] tabular-nums">
        {rows.map(({ key, amount }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm" style={{ background: TIER_THEME[key].hex }} aria-hidden="true" />
              <span className="text-gray-600">{TIER_THEME[key].label}</span>
            </span>
            <span className="font-medium text-gray-900">{fmtUSD0(amount)}</span>
          </div>
        ))}
      </div>
      {income !== null && net !== null && (
        <div className="mt-1.5 space-y-0.5 border-t border-gray-200 pt-1.5 text-[11px] tabular-nums">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0 border-t-2 border-dashed" style={{ borderColor: INCOME_HEX }} aria-hidden="true" />
              <span className="text-gray-600">Income</span>
            </span>
            <span className="font-medium text-gray-900">{fmtUSD0(income)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className={net >= 0 ? 'text-emerald-700' : 'text-red-700'}>{net >= 0 ? 'Surplus' : 'Deficit'}</span>
            <span className={cn('font-semibold', net >= 0 ? 'text-emerald-700' : 'text-red-700')}>
              {net >= 0 ? '+' : '−'}{fmtUSD0(Math.abs(net))}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
