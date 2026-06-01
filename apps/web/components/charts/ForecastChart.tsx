'use client'

import { useMemo, useRef, useState, type MouseEvent, type TouchEvent } from 'react'
import { cn } from '@/lib/cn'

export interface ForecastChartPoint {
  /** ISO yyyy-mm-dd. */
  readonly date: string
  /** Projected balance at end-of-day. */
  readonly balance: number
  /** Optional: net change applied this day. Shown in the tooltip when present. */
  readonly netChange?: number
  /** Optional: total inflow this day. Shown in the tooltip when present and > 0. */
  readonly inflow?: number
  /** Optional: total outflow this day. Shown in the tooltip when present and > 0. */
  readonly outflow?: number
}

export interface ForecastChartProps {
  points: ReadonlyArray<ForecastChartPoint>
  /** Optional dashed baseline (e.g., today's cash). */
  baseline?: number
  label?: string
  className?: string
  formatValue?: (v: number) => string
  formatDate?: (iso: string) => string
}

const W = 320
const H = 80
const PAD_Y = 4

/**
 * Interactive cashflow chart. Same visual line as the static Sparkline, but
 * tracks pointer/touch position and shows a vertical guide + dot + tooltip
 * with the date and balance at that point. Tooltip uses HTML positioning so
 * it can render text crisply at any container size.
 */
export function ForecastChart({
  points,
  baseline,
  label,
  className,
  formatValue,
  formatDate
}: ForecastChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const valueFn = formatValue ?? defaultValueFormatter
  const dateFn = formatDate ?? defaultDateFormatter

  const balances = useMemo(() => points.map(p => p.balance), [points])

  const geom = useMemo(
    () => computeForecastGeometry({
      values: balances,
      ...(baseline !== undefined ? { baseline } : {}),
      width: W,
      height: H,
      padY: PAD_Y
    }),
    [balances, baseline]
  )

  function indexFromClientX(clientX: number): number | null {
    const svg = svgRef.current
    if (!svg || points.length < 2) return null
    const rect = svg.getBoundingClientRect()
    if (rect.width <= 0) return null
    const x = clientX - rect.left
    const ratio = clamp01(x / rect.width)
    return Math.round(ratio * (points.length - 1))
  }

  function handleMove(clientX: number) {
    const idx = indexFromClientX(clientX)
    setHoverIdx(idx)
  }

  function onMouseMove(e: MouseEvent<SVGSVGElement>) { handleMove(e.clientX) }
  function onMouseLeave() { setHoverIdx(null) }
  function onTouchMove(e: TouchEvent<SVGSVGElement>) {
    const t = e.touches[0]
    if (t) handleMove(t.clientX)
  }
  function onTouchStart(e: TouchEvent<SVGSVGElement>) {
    const t = e.touches[0]
    if (t) handleMove(t.clientX)
  }
  function onTouchEnd() { setHoverIdx(null) }

  const hovered = hoverIdx != null ? points[hoverIdx] : undefined
  const hoveredCoord = hoverIdx != null && hovered ? coordForIndex({ index: hoverIdx, total: points.length, value: hovered.balance, geom }) : null

  return (
    <div className={cn('relative w-full', className)}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={label}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-24 overflow-visible cursor-crosshair touch-none"
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {geom.fillPath && (
          <path d={geom.fillPath} fill="var(--color-ink)" fillOpacity={0.08} />
        )}
        {geom.baselineY != null && (
          <line
            x1={0}
            x2={W}
            y1={geom.baselineY}
            y2={geom.baselineY}
            stroke="var(--color-rule)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}
        {geom.linePath && (
          <path
            d={geom.linePath}
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {hoveredCoord && (
          <>
            <line
              x1={hoveredCoord.x}
              x2={hoveredCoord.x}
              y1={0}
              y2={H}
              stroke="var(--color-ink)"
              strokeOpacity={0.25}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={hoveredCoord.x}
              cy={hoveredCoord.y}
              r={3.5}
              fill="var(--color-ink)"
              stroke="white"
              strokeWidth={1.5}
            />
          </>
        )}
      </svg>

      {/* Permanent start/end markers when not hovering */}
      {points.length >= 2 && hoverIdx == null && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-5 flex justify-between text-[10px] text-muted tabular-nums">
          <span>{dateFn(points[0]!.date)}</span>
          <span>{dateFn(points[points.length - 1]!.date)}</span>
        </div>
      )}

      {hovered && hoveredCoord && (
        <ForecastTooltip
          point={hovered}
          xRatio={hoverIdx! / Math.max(1, points.length - 1)}
          formatValue={valueFn}
          formatDate={dateFn}
        />
      )}
    </div>
  )
}

interface TooltipProps {
  point: ForecastChartPoint
  xRatio: number
  formatValue: (v: number) => string
  formatDate: (iso: string) => string
}

function ForecastTooltip({ point, xRatio, formatValue, formatDate }: TooltipProps) {
  // Anchor the tooltip just above the chart at xRatio across the container.
  // Pull it leftward as xRatio approaches 1 so the tooltip can't clip off the
  // right edge; push rightward near 0 so it can't clip off the left.
  const translateX = `calc(${(xRatio * 100).toFixed(2)}% - ${Math.round(xRatio * 100)}px)`
  const flow = (point.inflow ?? 0) - (point.outflow ?? 0)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute -top-2 z-10 -translate-y-full whitespace-nowrap rounded-md bg-ink/95 text-white px-2 py-1 text-[11px] shadow-lg"
      style={{ left: translateX }}
    >
      <div className="font-semibold tabular-nums">{formatValue(point.balance)}</div>
      <div className="text-white/70 tabular-nums">{formatDate(point.date)}</div>
      {(point.netChange != null && point.netChange !== 0) && (
        <div
          className={cn(
            'mt-0.5 tabular-nums',
            flow >= 0 ? 'text-emerald-300' : 'text-red-300'
          )}
        >
          {flow > 0 ? '+' : ''}{formatValue(flow)} today
        </div>
      )}
    </div>
  )
}

// ─── geometry ───────────────────────────────────────────────────────────────

export interface ComputeForecastGeometryInput {
  values: ReadonlyArray<number>
  baseline?: number
  width: number
  height: number
  padY: number
}

export interface ComputedForecastGeometry {
  linePath: string | null
  fillPath: string | null
  baselineY: number | null
  /** Min y-value used to compute the scale. */
  min: number
  /** Max y-value used to compute the scale. */
  max: number
}

/**
 * Pure SVG geometry computation for the forecast chart. Mirrors
 * the static Sparkline's algorithm so the visual line is identical;
 * exposes min/max so callers can derive marker positions.
 */
export function computeForecastGeometry(
  input: ComputeForecastGeometryInput
): ComputedForecastGeometry {
  const { values, baseline, width, height, padY } = input

  if (values.length < 2) {
    return { linePath: null, fillPath: null, baselineY: null, min: 0, max: 0 }
  }

  const usableMin = padY
  const usableMax = height - padY

  const valuesForScale = baseline !== undefined ? [...values, baseline] : [...values]
  const min = Math.min(...valuesForScale)
  const max = Math.max(...valuesForScale)
  const range = max - min || 1

  function yOf(v: number): number {
    return usableMax - ((v - min) / range) * (usableMax - usableMin)
  }
  function xOf(i: number): number {
    if (values.length === 1) return width / 2
    return (i / (values.length - 1)) * width
  }

  const linePath = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)}`)
    .join(' ')

  const fillPath =
    linePath +
    ` L ${xOf(values.length - 1).toFixed(2)} ${height} L ${xOf(0).toFixed(2)} ${height} Z`

  const baselineY = baseline !== undefined ? yOf(baseline) : null

  return { linePath, fillPath, baselineY, min, max }
}

interface CoordInput {
  index: number
  total: number
  value: number
  geom: ComputedForecastGeometry
}

/**
 * Compute the (x, y) SVG coordinate for a given (index, value) pair using the
 * same scale the line path was built with. Returns null when the geometry has
 * no scale (single point or empty).
 */
export function coordForIndex(input: CoordInput): { x: number; y: number } | null {
  const { index, total, value, geom } = input
  if (geom.linePath == null) return null
  const x = total <= 1 ? W / 2 : (index / (total - 1)) * W
  const range = geom.max - geom.min || 1
  const usableMin = PAD_Y
  const usableMax = H - PAD_Y
  const y = usableMax - ((value - geom.min) / range) * (usableMax - usableMin)
  return { x, y }
}

function defaultValueFormatter(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function defaultDateFormatter(iso: string): string {
  // Parse as UTC to avoid a timezone shift turning 2026-06-01 into May 31.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const year = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10) - 1
  const day = parseInt(m[3]!, 10)
  const d = new Date(Date.UTC(year, month, day))
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}
