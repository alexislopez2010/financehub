import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline, computeGeometry } from './Sparkline'

describe('computeGeometry', () => {
  const W = 320, H = 80, padY = 4

  it('returns null paths for < 2 points', () => {
    expect(computeGeometry({ points: [], width: W, height: H, padY })).toEqual({
      linePath: null,
      fillPath: null,
      baselineY: null
    })
    expect(computeGeometry({ points: [10], width: W, height: H, padY })).toEqual({
      linePath: null,
      fillPath: null,
      baselineY: null
    })
  })

  it('places first and last x at 0 and width', () => {
    const g = computeGeometry({ points: [10, 20], width: W, height: H, padY })
    expect(g.linePath).toMatch(/^M 0\.00 /)
    expect(g.linePath).toMatch(/L 320\.00 /)
  })

  it('produces a flat path when all values are equal', () => {
    const g = computeGeometry({ points: [10, 10, 10], width: W, height: H, padY })
    // Three points along a flat line at y = (usableMax + usableMin) / 2... actually our formula
    // gives the max-value y at usableMin, and with flat values range=1, all values map to usableMax.
    // We just assert the path has 3 segments and all Ys are identical.
    expect(g.linePath).not.toBeNull()
    const ys = (g.linePath!.match(/-?\d+\.\d+/g) ?? [])
      .filter((_, i) => i % 2 === 1)  // every other capture is a y
    expect(new Set(ys).size).toBe(1)
  })

  it('puts the highest value near the top and the lowest near the bottom', () => {
    const g = computeGeometry({ points: [0, 100], width: W, height: H, padY })
    // First point (0) should be at usableMax (76); second (100) at usableMin (4).
    expect(g.linePath).toMatch(/^M 0\.00 76\.00 L 320\.00 4\.00$/)
  })

  it('returns a fill path that closes at the bottom', () => {
    const g = computeGeometry({ points: [10, 20], width: W, height: H, padY })
    expect(g.fillPath).toMatch(/Z$/)
    expect(g.fillPath).toContain(` L 320.00 ${H}`)
    expect(g.fillPath).toContain(` L 0.00 ${H}`)
  })

  it('includes baseline in y-scale and exposes its y coordinate', () => {
    const g = computeGeometry({ points: [10, 20], baseline: 15, width: W, height: H, padY })
    expect(g.baselineY).not.toBeNull()
    // With min=10, max=20, baseline=15 → exactly halfway, mapped to (usableMin+usableMax)/2.
    expect(g.baselineY!).toBeCloseTo((4 + 76) / 2, 1)
  })

  it('baselineY is null when no baseline provided', () => {
    const g = computeGeometry({ points: [10, 20], width: W, height: H, padY })
    expect(g.baselineY).toBeNull()
  })

  it('baseline outside the data range still gets a y coordinate (clipping is rendering concern)', () => {
    const g = computeGeometry({ points: [10, 20], baseline: 100, width: W, height: H, padY })
    // baseline 100 is the max → maps to usableMin = 4.
    expect(g.baselineY!).toBeCloseTo(4, 1)
  })
})

describe('<Sparkline>', () => {
  it('renders an svg with the given aria-label', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} label="30-day forecast" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-label')).toBe('30-day forecast')
    expect(svg!.getAttribute('role')).toBe('img')
  })

  it('renders nothing inside when < 2 points', () => {
    const { container } = render(<Sparkline points={[1]} />)
    expect(container.querySelector('path')).toBeNull()
    expect(container.querySelector('line')).toBeNull()
  })

  it('renders a line path when points are provided', () => {
    const { container } = render(<Sparkline points={[10, 20, 15, 30]} />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThanOrEqual(1)
    // At least one path with M..L sequence
    expect(Array.from(paths).some(p => /M\s+\d/.test(p.getAttribute('d') ?? ''))).toBe(true)
  })

  it('renders a baseline line element when baseline provided', () => {
    const { container } = render(<Sparkline points={[10, 20]} baseline={15} />)
    expect(container.querySelector('line')).not.toBeNull()
  })

  it('does NOT render a baseline line when baseline omitted', () => {
    const { container } = render(<Sparkline points={[10, 20]} />)
    expect(container.querySelector('line')).toBeNull()
  })

  it('renders a filled area when fill=true (default)', () => {
    const { container } = render(<Sparkline points={[10, 20, 30]} />)
    // Two paths: fill + line.
    expect(container.querySelectorAll('path').length).toBe(2)
  })

  it('omits the fill path when fill=false', () => {
    const { container } = render(<Sparkline points={[10, 20, 30]} fill={false} />)
    expect(container.querySelectorAll('path').length).toBe(1)
  })

  it('merges custom className', () => {
    const { container } = render(<Sparkline points={[1, 2, 3]} className="my-custom" />)
    expect(container.querySelector('svg')?.classList.contains('my-custom')).toBe(true)
  })
})
