import { cn } from '@/lib/cn'

export interface SparklineProps {
  /** Y-values in chronological order. Must have at least 2 points to render the line. */
  points: ReadonlyArray<number>
  /** Optional baseline value (e.g. starting balance) drawn as a dashed horizontal rule. */
  baseline?: number
  /** Optional class to override sizing/color on the SVG element itself. */
  className?: string
  /** Aria label for the sparkline. */
  label?: string
  /** Fill below the line. Default true. */
  fill?: boolean
}

/**
 * Minimal SVG sparkline. Uses a 320x80 viewBox; the SVG scales to fit
 * its container via width=100% height=100% and preserveAspectRatio=none.
 *
 * Rendering notes:
 *   - With < 2 points, renders an empty svg (no path) to keep layout stable.
 *   - All identical values render as a flat line at vertical center.
 *   - Baseline (if provided) draws a dashed rule at the baseline value.
 */
export function Sparkline({
  points,
  baseline,
  className,
  label,
  fill = true
}: SparklineProps) {
  const W = 320
  const H = 80
  const padY = 4

  const { linePath, fillPath, baselineY } = computeGeometry({
    points,
    ...(baseline !== undefined ? { baseline } : {}),
    width: W,
    height: H,
    padY
  })

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn('w-full h-20 overflow-visible', className)}
    >
      {fill && fillPath && (
        <path d={fillPath} fill="var(--color-ink)" fillOpacity={0.08} />
      )}
      {baselineY != null && (
        <line
          x1={0}
          x2={W}
          y1={baselineY}
          y2={baselineY}
          stroke="var(--color-rule)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      )}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

interface ComputeGeometryInput {
  points: ReadonlyArray<number>
  baseline?: number
  width: number
  height: number
  padY: number
}

interface ComputedGeometry {
  /** SVG `d` for the line path, or null when not enough points. */
  linePath: string | null
  /** SVG `d` for the area fill below the line, or null when no line. */
  fillPath: string | null
  /** Y coordinate (in SVG units) of the baseline line, or null if no baseline / out of range. */
  baselineY: number | null
}

/**
 * Pure SVG geometry computation. Exported for testing.
 */
export function computeGeometry(input: ComputeGeometryInput): ComputedGeometry {
  const { points, baseline, width, height, padY } = input

  if (points.length < 2) {
    return { linePath: null, fillPath: null, baselineY: null }
  }

  const usableMin = padY
  const usableMax = height - padY

  // Include baseline in the y-scale so it's visible if within range.
  const valuesForScale = baseline !== undefined ? [...points, baseline] : [...points]
  const min = Math.min(...valuesForScale)
  const max = Math.max(...valuesForScale)
  const range = max - min || 1  // avoid /0 for flat data

  function yOf(v: number): number {
    // Invert: max value maps to usableMin (top), min value to usableMax (bottom).
    return usableMax - ((v - min) / range) * (usableMax - usableMin)
  }

  function xOf(i: number): number {
    if (points.length === 1) return width / 2
    return (i / (points.length - 1)) * width
  }

  // Build the line path
  const linePath = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(2)} ${yOf(v).toFixed(2)}`)
    .join(' ')

  // Build the fill path: same line, then down to bottom, across to start, close.
  const fillPath =
    linePath +
    ` L ${xOf(points.length - 1).toFixed(2)} ${height} L ${xOf(0).toFixed(2)} ${height} Z`

  const baselineY = baseline !== undefined ? yOf(baseline) : null

  return { linePath, fillPath, baselineY }
}
