import { describe, it, expect } from 'vitest'
import { currentPeriod, periodLabel, periodLabelShort, parsePeriod, navigatePeriod, periodToRange } from './period'

describe('currentPeriod', () => {
  it('returns 1-indexed month + 4-digit year', () => {
    const p = currentPeriod(new Date('2026-05-15T12:00:00Z'))
    expect(p).toEqual({ year: 2026, month: 5 })
  })

  it('treats Dec 31 as December', () => {
    const p = currentPeriod(new Date(2025, 11, 31, 12))
    expect(p).toEqual({ year: 2025, month: 12 })
  })

  it('treats Jan 1 as January', () => {
    const p = currentPeriod(new Date(2026, 0, 1, 12))
    expect(p).toEqual({ year: 2026, month: 1 })
  })
})

describe('periodLabel / periodLabelShort', () => {
  it('formats human-readable label', () => {
    expect(periodLabel({ year: 2026, month: 5 })).toBe('May 2026')
  })

  it('formats uppercase variant', () => {
    expect(periodLabelShort({ year: 2026, month: 5 })).toBe('MAY 2026')
  })

  it('handles all 12 months', () => {
    const expected = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ]
    for (let m = 1; m <= 12; m += 1) {
      expect(periodLabel({ year: 2026, month: m })).toBe(`${expected[m - 1]} 2026`)
    }
  })
})

describe('parsePeriod', () => {
  const fb: { year: number; month: number } = { year: 2026, month: 5 }

  it('returns fallback when both params null', () => {
    expect(parsePeriod(null, null, fb)).toEqual(fb)
  })

  it('returns fallback when one param missing', () => {
    expect(parsePeriod('2025', null, fb)).toEqual(fb)
    expect(parsePeriod(null, '5', fb)).toEqual(fb)
  })

  it('returns fallback when year out of range', () => {
    expect(parsePeriod('1800', '5', fb)).toEqual(fb)
    expect(parsePeriod('3000', '5', fb)).toEqual(fb)
  })

  it('returns fallback when month out of range', () => {
    expect(parsePeriod('2025', '0', fb)).toEqual(fb)
    expect(parsePeriod('2025', '13', fb)).toEqual(fb)
    expect(parsePeriod('2025', '-1', fb)).toEqual(fb)
  })

  it('returns fallback for non-integer inputs', () => {
    expect(parsePeriod('abc', '5', fb)).toEqual(fb)
    expect(parsePeriod('2025', 'xyz', fb)).toEqual(fb)
  })

  it('parses valid year/month strings', () => {
    expect(parsePeriod('2025', '7', fb)).toEqual({ year: 2025, month: 7 })
  })
})

describe('navigatePeriod', () => {
  it('moves forward within the same year', () => {
    expect(navigatePeriod({ year: 2026, month: 5 }, 1)).toEqual({ year: 2026, month: 6 })
  })

  it('moves backward within the same year', () => {
    expect(navigatePeriod({ year: 2026, month: 5 }, -1)).toEqual({ year: 2026, month: 4 })
  })

  it('rolls forward into next January', () => {
    expect(navigatePeriod({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 })
  })

  it('rolls backward into previous December', () => {
    expect(navigatePeriod({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })
})

describe('periodToRange', () => {
  it('returns YYYY-MM-01 → end-of-month', () => {
    expect(periodToRange({ year: 2026, month: 5 })).toEqual({
      startDate: '2026-05-01',
      endDate: '2026-05-31'
    })
  })

  it('handles 30-day months', () => {
    expect(periodToRange({ year: 2026, month: 4 })).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-04-30'
    })
  })

  it('handles February in non-leap year', () => {
    expect(periodToRange({ year: 2025, month: 2 })).toEqual({
      startDate: '2025-02-01',
      endDate: '2025-02-28'
    })
  })

  it('handles February in leap year', () => {
    expect(periodToRange({ year: 2024, month: 2 })).toEqual({
      startDate: '2024-02-01',
      endDate: '2024-02-29'
    })
  })
})
