import { describe, it, expect } from 'vitest'
import { daysInMonth, clampDay, isDueOn, daysUntilDue } from './dueDate'

describe('daysInMonth', () => {
  it('returns 31 for 31-day months', () => {
    expect(daysInMonth(2025, 1)).toBe(31)
    expect(daysInMonth(2025, 3)).toBe(31)
    expect(daysInMonth(2025, 5)).toBe(31)
    expect(daysInMonth(2025, 7)).toBe(31)
    expect(daysInMonth(2025, 8)).toBe(31)
    expect(daysInMonth(2025, 10)).toBe(31)
    expect(daysInMonth(2025, 12)).toBe(31)
  })

  it('returns 30 for 30-day months', () => {
    expect(daysInMonth(2025, 4)).toBe(30)
    expect(daysInMonth(2025, 6)).toBe(30)
    expect(daysInMonth(2025, 9)).toBe(30)
    expect(daysInMonth(2025, 11)).toBe(30)
  })

  it('returns 28 for February in a common year', () => {
    expect(daysInMonth(2025, 2)).toBe(28)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2026, 2)).toBe(28)
  })

  it('returns 29 for February in a leap year', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2000, 2)).toBe(29)  // divisible by 400
  })

  it('correctly handles century non-leap years', () => {
    expect(daysInMonth(1900, 2)).toBe(28)  // divisible by 100, not 400
    expect(daysInMonth(2100, 2)).toBe(28)
  })

  it('throws on out-of-range month', () => {
    expect(() => daysInMonth(2025, 0)).toThrow(RangeError)
    expect(() => daysInMonth(2025, 13)).toThrow(RangeError)
    expect(() => daysInMonth(2025, -1)).toThrow(RangeError)
  })
})

describe('clampDay', () => {
  it('returns the day unchanged when within the month', () => {
    expect(clampDay(15, 2025, 7)).toBe(15)
    expect(clampDay(1, 2025, 7)).toBe(1)
    expect(clampDay(31, 2025, 1)).toBe(31)
    expect(clampDay(30, 2025, 4)).toBe(30)
  })

  it('clamps day=31 to the last day of short months', () => {
    expect(clampDay(31, 2025, 2)).toBe(28)
    expect(clampDay(31, 2024, 2)).toBe(29)  // leap
    expect(clampDay(31, 2025, 4)).toBe(30)
    expect(clampDay(31, 2025, 6)).toBe(30)
    expect(clampDay(31, 2025, 9)).toBe(30)
    expect(clampDay(31, 2025, 11)).toBe(30)
  })

  it('clamps day=30 to Feb 28/29', () => {
    expect(clampDay(30, 2025, 2)).toBe(28)
    expect(clampDay(30, 2024, 2)).toBe(29)
  })

  it('clamps day=29 to Feb 28 in non-leap years', () => {
    expect(clampDay(29, 2025, 2)).toBe(28)
    expect(clampDay(29, 2024, 2)).toBe(29)  // leap, unchanged
  })

  it('throws on day < 1', () => {
    expect(() => clampDay(0, 2025, 1)).toThrow(RangeError)
    expect(() => clampDay(-1, 2025, 1)).toThrow(RangeError)
  })

  it('throws on day > 31', () => {
    expect(() => clampDay(32, 2025, 1)).toThrow(RangeError)
    expect(() => clampDay(100, 2025, 1)).toThrow(RangeError)
  })

  it('throws on non-integer day', () => {
    expect(() => clampDay(1.5, 2025, 1)).toThrow(RangeError)
    expect(() => clampDay(NaN, 2025, 1)).toThrow(RangeError)
  })
})

describe('isDueOn', () => {
  it('matches when due_day equals the calendar day', () => {
    expect(isDueOn({ due_day: 15 }, { year: 2025, month: 7, day: 15 })).toBe(true)
    expect(isDueOn({ due_day: 1 }, { year: 2025, month: 7, day: 1 })).toBe(true)
  })

  it('does NOT match other days of the month', () => {
    expect(isDueOn({ due_day: 15 }, { year: 2025, month: 7, day: 14 })).toBe(false)
    expect(isDueOn({ due_day: 15 }, { year: 2025, month: 7, day: 16 })).toBe(false)
  })

  it('matches the clamped day in short months', () => {
    // due_day=31 in February → due on the 28th (or 29th leap year)
    expect(isDueOn({ due_day: 31 }, { year: 2025, month: 2, day: 28 })).toBe(true)
    expect(isDueOn({ due_day: 31 }, { year: 2025, month: 2, day: 27 })).toBe(false)
    expect(isDueOn({ due_day: 31 }, { year: 2024, month: 2, day: 29 })).toBe(true)
    expect(isDueOn({ due_day: 31 }, { year: 2024, month: 2, day: 28 })).toBe(false)  // leap: clamped to 29
    expect(isDueOn({ due_day: 31 }, { year: 2025, month: 4, day: 30 })).toBe(true)
  })

  it('returns false when due_day is null', () => {
    expect(isDueOn({ due_day: null }, { year: 2025, month: 7, day: 15 })).toBe(false)
  })
})

describe('daysUntilDue', () => {
  it('returns 0 when the bill is due today', () => {
    expect(daysUntilDue({ due_day: 15 }, { year: 2025, month: 7, day: 15 })).toBe(0)
  })

  it('returns 1 when the bill is due tomorrow within the same month', () => {
    expect(daysUntilDue({ due_day: 16 }, { year: 2025, month: 7, day: 15 })).toBe(1)
  })

  it('returns the correct count when crossing into next month', () => {
    // From July 30 to August 5 = 6 days.
    expect(daysUntilDue({ due_day: 5 }, { year: 2025, month: 7, day: 30 })).toBe(6)
  })

  it('returns the count when crossing a year boundary', () => {
    // From Dec 30 to Jan 5 = 6 days.
    expect(daysUntilDue({ due_day: 5 }, { year: 2025, month: 12, day: 30 })).toBe(6)
  })

  it('uses the clamped day for short next months', () => {
    // From Jan 30, next due_day=31 lands on Jan 31 itself (1 day away)
    expect(daysUntilDue({ due_day: 31 }, { year: 2025, month: 1, day: 30 })).toBe(1)  // Jan 31 itself
    // From Feb 1, next due_day=31 → Feb 28 (clamped) = 27 days.
    expect(daysUntilDue({ due_day: 31 }, { year: 2025, month: 2, day: 1 })).toBe(27)
  })

  it('handles leap year February correctly', () => {
    // From Feb 1 2024 (leap), next due_day=31 → Feb 29 = 28 days.
    expect(daysUntilDue({ due_day: 31 }, { year: 2024, month: 2, day: 1 })).toBe(28)
  })

  it('returns null when due_day is null', () => {
    expect(daysUntilDue({ due_day: null }, { year: 2025, month: 7, day: 15 })).toBeNull()
  })
})
