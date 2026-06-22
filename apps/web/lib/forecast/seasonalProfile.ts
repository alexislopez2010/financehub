/**
 * Compact per-bill seasonal profile stored in bills.seasonal_profile (jsonb).
 * 12 monthly baselines (index 0 = January) + provenance. Raw history is NOT
 * retained — this distilled shape is all that survives the one-time import.
 */

export interface SeasonalProfile {
  /** Length 12, index 0 = January. Projected baseline amount per calendar month. */
  baseline: number[]
  /** Where the profile came from. */
  source: 'import' | 'ledger'
  /** How many years of history informed it. */
  years: number
  /** ISO date the profile was computed. */
  computed_at: string
  /** Plain-English rationale (captured from the AI import in Phase 3). */
  note: string
}

/** Safely narrows untrusted jsonb (the DB column type is Json | null). */
export function parseSeasonalProfile(raw: unknown): SeasonalProfile | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const baseline = o.baseline
  if (!Array.isArray(baseline) || baseline.length !== 12) return null
  if (!baseline.every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const source = o.source === 'import' || o.source === 'ledger' ? o.source : 'ledger'
  return {
    baseline: baseline as number[],
    source,
    years: typeof o.years === 'number' ? o.years : 0,
    computed_at: typeof o.computed_at === 'string' ? o.computed_at : '',
    note: typeof o.note === 'string' ? o.note : ''
  }
}

/** Returns the profile baseline for a 1-indexed calendar month (1..12). */
export function amountForMonth(profile: SeasonalProfile, month: number): number {
  if (month < 1 || month > 12) {
    throw new Error(`amountForMonth: month out of range: ${month}`)
  }
  return profile.baseline[month - 1]!
}
