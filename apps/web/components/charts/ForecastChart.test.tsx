import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  ForecastChart,
  computeForecastGeometry,
  coordForIndex,
  type ForecastChartPoint
} from './ForecastChart'

function p(date: string, balance: number, extra?: Partial<ForecastChartPoint>): ForecastChartPoint {
  return { date, balance, ...extra }
}

const POINTS: ReadonlyArray<ForecastChartPoint> = [
  p('2026-06-01', 1000),
  p('2026-06-02', 1100, { inflow: 100 }),
  p('2026-06-03', 900,  { outflow: 200, netChange: -200 }),
  p('2026-06-04', 950),
  p('2026-06-05', 1500, { inflow: 550, netChange: 550 })
]

describe('computeForecastGeometry', () => {
  it('returns null paths and zero min/max for empty input', () => {
    const g = computeForecastGeometry({ values: [], width: 320, height: 80, padY: 4 })
    expect(g.linePath).toBeNull()
    expect(g.fillPath).toBeNull()
    expect(g.baselineY).toBeNull()
  })

  it('returns null paths for a single point', () => {
    const g = computeForecastGeometry({ values: [100], width: 320, height: 80, padY: 4 })
    expect(g.linePath).toBeNull()
  })

  it('returns a line path that starts with M and contains the expected number of segments', () => {
    const g = computeForecastGeometry({ values: [1, 2, 3, 4], width: 320, height: 80, padY: 4 })
    expect(g.linePath).toMatch(/^M /)
    // M + 3 L segments
    expect((g.linePath ?? '').match(/L /g)?.length).toBe(3)
  })

  it('sets min/max from data, expanded to include the baseline when supplied', () => {
    const g = computeForecastGeometry({ values: [100, 200], baseline: 500, width: 320, height: 80, padY: 4 })
    expect(g.min).toBe(100)
    expect(g.max).toBe(500)
  })

  it('places the fill path so it closes back to the chart floor', () => {
    const g = computeForecastGeometry({ values: [10, 20, 30], width: 320, height: 80, padY: 4 })
    expect(g.fillPath).toMatch(/Z$/)
    expect(g.fillPath).toContain('L 320.00 80')
    expect(g.fillPath).toContain('L 0.00 80')
  })
})

describe('coordForIndex', () => {
  const geom = computeForecastGeometry({ values: [100, 200, 300, 400], width: 320, height: 80, padY: 4 })

  it('returns null when geometry has no line path (single point)', () => {
    const empty = computeForecastGeometry({ values: [100], width: 320, height: 80, padY: 4 })
    expect(coordForIndex({ index: 0, total: 1, value: 100, geom: empty })).toBeNull()
  })

  it('maps index 0 to x=0 and the last index to x=width', () => {
    const first = coordForIndex({ index: 0, total: 4, value: 100, geom: geom })
    const last = coordForIndex({ index: 3, total: 4, value: 400, geom: geom })
    expect(first?.x).toBeCloseTo(0, 5)
    expect(last?.x).toBeCloseTo(320, 5)
  })

  it('places the minimum-value point at the chart floor and maximum at the chart ceiling', () => {
    // padY=4, height=80 → min should land at y=76, max at y=4
    const lo = coordForIndex({ index: 0, total: 4, value: 100, geom: geom })
    const hi = coordForIndex({ index: 3, total: 4, value: 400, geom: geom })
    expect(lo?.y).toBeCloseTo(76, 5)
    expect(hi?.y).toBeCloseTo(4, 5)
  })
})

describe('<ForecastChart>', () => {
  it('renders an accessible svg with the supplied label', () => {
    render(<ForecastChart points={POINTS} label="Projected balance" />)
    expect(screen.getByRole('img', { name: /projected balance/i })).toBeInTheDocument()
  })

  it('renders an empty svg with no line path when fewer than 2 points are supplied', () => {
    const { container } = render(<ForecastChart points={[p('2026-06-01', 1000)]} label="x" />)
    // No path elements rendered
    expect(container.querySelectorAll('path').length).toBe(0)
  })

  it('shows start/end date markers when no point is hovered', () => {
    render(<ForecastChart points={POINTS} label="x" />)
    // Default formatter produces "Jun 1" and "Jun 5"
    expect(screen.getByText(/Jun 1/)).toBeInTheDocument()
    expect(screen.getByText(/Jun 5/)).toBeInTheDocument()
  })

  it('hovering over the svg surfaces a tooltip with the date and balance of the nearest point', () => {
    const { container } = render(<ForecastChart points={POINTS} label="x" />)
    const svg = container.querySelector('svg')!
    // Stub getBoundingClientRect so the geometry math has a known frame to work with.
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 80, width: 320, height: 80, toJSON: () => ({})
    } as DOMRect)

    // Hover at the very right edge → should pick the last point (index 4 → Jun 5, $1,500).
    fireEvent.mouseMove(svg, { clientX: 320 })
    expect(screen.getByRole('status').textContent ?? '').toMatch(/\$1,500/)
    expect(screen.getByRole('status').textContent ?? '').toMatch(/Jun 5/)
  })

  it('clears the tooltip on mouse leave', () => {
    const { container } = render(<ForecastChart points={POINTS} label="x" />)
    const svg = container.querySelector('svg')!
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 80, width: 320, height: 80, toJSON: () => ({})
    } as DOMRect)

    fireEvent.mouseMove(svg, { clientX: 160 })
    expect(screen.queryByRole('status')).toBeInTheDocument()
    fireEvent.mouseLeave(svg)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders the dashed baseline when supplied', () => {
    const { container } = render(<ForecastChart points={POINTS} baseline={1000} label="x" />)
    // The baseline is the only <line> with strokeDasharray="2 3" in the static state.
    const dashed = container.querySelector('line[stroke-dasharray="2 3"]')
    expect(dashed).not.toBeNull()
  })
})
