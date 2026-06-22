import { describe, expect, it } from 'vitest'
import { parseSeasonalProfile, amountForMonth, type SeasonalProfile } from './seasonalProfile'

const valid: SeasonalProfile = {
  baseline: [180, 170, 140, 90, 60, 45, 40, 40, 55, 90, 130, 175],
  source: 'import',
  years: 3,
  computed_at: '2026-06-21',
  note: 'Winter peak Dec–Feb; 2024 ~8% over 2023.'
}

describe('parseSeasonalProfile', () => {
  it('parses a valid profile object', () => {
    expect(parseSeasonalProfile(valid)).toEqual(valid)
  })

  it('returns null for null / undefined', () => {
    expect(parseSeasonalProfile(null)).toBeNull()
    expect(parseSeasonalProfile(undefined)).toBeNull()
  })

  it('returns null when baseline is not length 12', () => {
    expect(parseSeasonalProfile({ ...valid, baseline: [1, 2, 3] })).toBeNull()
  })

  it('returns null when baseline contains a non-number', () => {
    const bad = { ...valid, baseline: [...valid.baseline.slice(0, 11), 'x'] }
    expect(parseSeasonalProfile(bad)).toBeNull()
  })

  it('returns null for a non-object', () => {
    expect(parseSeasonalProfile('nope')).toBeNull()
    expect(parseSeasonalProfile(42)).toBeNull()
  })
})

describe('amountForMonth', () => {
  it('returns the baseline for the 1-indexed month', () => {
    expect(amountForMonth(valid, 1)).toBe(180)   // January
    expect(amountForMonth(valid, 12)).toBe(175)  // December
  })

  it('throws for an out-of-range month', () => {
    expect(() => amountForMonth(valid, 0)).toThrow()
    expect(() => amountForMonth(valid, 13)).toThrow()
  })
})
