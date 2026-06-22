import { describe, expect, it } from 'vitest'
import { distillSeasonalProfile, type HistoryObservation } from './distillHistory'

const AT = '2026-06-22'

/** Builds 12 monthly observations for a given year from a baseline array. */
function yearObs(year: number, amounts: number[]): HistoryObservation[] {
  return amounts.map((amount, i) => ({ year, month: i + 1, amount }))
}

describe('distillSeasonalProfile', () => {
  it('averages each calendar month across years (code counts, not the AI)', () => {
    const obs = [
      ...yearObs(2024, [180, 170, 140, 90, 60, 45, 40, 40, 55, 90, 130, 175]),
      ...yearObs(2025, [200, 190, 160, 110, 80, 55, 50, 50, 65, 100, 150, 195])
    ]
    const res = distillSeasonalProfile(obs, { computedAt: AT, note: 'gas' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // January = mean(180, 200) = 190
    expect(res.profile.baseline[0]).toBe(190)
    // July = mean(40, 50) = 45
    expect(res.profile.baseline[6]).toBe(45)
    expect(res.profile.years).toBe(2)
    expect(res.monthsCovered).toBe(12)
    expect(res.observationsUsed).toBe(24)
    expect(res.warnings).toHaveLength(0)
    expect(res.profile.source).toBe('import')
    expect(res.profile.computed_at).toBe(AT)
    expect(res.profile.note).toBe('gas')
  })

  it('rounds monthly averages to cents', () => {
    const obs = [
      { year: 2024, month: 1, amount: 100 },
      { year: 2025, month: 1, amount: 105.01 },
      { year: 2026, month: 1, amount: 110.02 }
    ]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    // mean(100, 105.01, 110.02) = 105.01
    expect(res.profile.baseline[0]).toBe(105.01)
  })

  it('fills months with no history using the average of covered months and warns', () => {
    // Only Dec + Jan + Feb provided (a winter-only bill history).
    const obs: HistoryObservation[] = [
      { year: 2025, month: 12, amount: 180 },
      { year: 2026, month: 1, amount: 200 },
      { year: 2026, month: 2, amount: 160 }
    ]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.monthsCovered).toBe(3)
    // Covered months keep their values.
    expect(res.profile.baseline[11]).toBe(180)
    expect(res.profile.baseline[0]).toBe(200)
    expect(res.profile.baseline[1]).toBe(160)
    // A missing month (e.g. July) is filled with the mean of covered months = 180.
    expect(res.profile.baseline[6]).toBe(180)
    expect(res.warnings.some(w => /9 month/.test(w))).toBe(true)
  })

  it('normalizes negative amounts to their magnitude (spend is positive)', () => {
    const obs: HistoryObservation[] = [{ year: 2025, month: 3, amount: -142.5 }]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.profile.baseline[2]).toBe(142.5)
  })

  it('drops observations with an out-of-range month', () => {
    const obs = [
      { year: 2025, month: 0, amount: 100 },
      { year: 2025, month: 13, amount: 100 },
      { year: 2025, month: 6, amount: 60 }
    ]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.observationsUsed).toBe(1)
    expect(res.profile.baseline[5]).toBe(60)
  })

  it('drops observations with a non-finite amount', () => {
    const obs = [
      { year: 2025, month: 4, amount: Number.NaN },
      { year: 2025, month: 4, amount: Number.POSITIVE_INFINITY },
      { year: 2025, month: 4, amount: 88 }
    ]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.observationsUsed).toBe(1)
    expect(res.profile.baseline[3]).toBe(88)
  })

  it('fails when there are no valid observations', () => {
    const res = distillSeasonalProfile([], { computedAt: AT })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toMatch(/no .*history/i)
  })

  it('counts distinct years even when months overlap', () => {
    const obs = [
      { year: 2023, month: 1, amount: 100 },
      { year: 2024, month: 1, amount: 110 },
      { year: 2024, month: 2, amount: 90 }
    ]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.profile.years).toBe(2)
  })

  it('defaults the note to empty string when none is given', () => {
    const obs = [{ year: 2025, month: 1, amount: 100 }]
    const res = distillSeasonalProfile(obs, { computedAt: AT })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.profile.note).toBe('')
  })
})
