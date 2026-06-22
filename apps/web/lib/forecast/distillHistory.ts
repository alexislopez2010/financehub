/**
 * Distills raw per-month history OBSERVATIONS into a compact SeasonalProfile.
 *
 * This is the "code counts" half of the AI import: the model only reads messy
 * history and emits structured {year, month, amount} observations — every number
 * in the resulting profile is computed HERE, deterministically, from those
 * observations. The model never hands us a baseline to trust.
 *
 * Pure: the caller injects `computedAt` (no Date.now()).
 */

import type { SeasonalProfile } from './seasonalProfile'
import { round2 } from './utils'

export interface HistoryObservation {
  /** Calendar year of the observation. */
  year: number
  /** 1..12 (1 = January). */
  month: number
  /** Billed amount; sign is normalized to magnitude. */
  amount: number
}

export interface DistillOptions {
  /** ISO date stamped onto the profile (injected for purity). */
  computedAt: string
  /** AI-authored rationale, passed through to the profile. Optional. */
  note?: string
}

export type DistillResult =
  | {
      ok: true
      profile: SeasonalProfile
      /** How many of the 12 calendar months had at least one observation. */
      monthsCovered: number
      /** How many observations survived validation and fed the averages. */
      observationsUsed: number
      /** Non-fatal notes (e.g. months filled from the average). */
      warnings: string[]
    }
  | { ok: false; error: string }

const MIN_YEAR = 1990
const MAX_YEAR = 2100
const MONTHS_IN_YEAR = 12
/** Reject absurd magnitudes so one bad value can't dominate the averages. */
const MAX_ABS_AMOUNT = 1_000_000

function isValidObservation(o: HistoryObservation): boolean {
  if (!Number.isInteger(o.month) || o.month < 1 || o.month > MONTHS_IN_YEAR) return false
  if (!Number.isInteger(o.year) || o.year < MIN_YEAR || o.year > MAX_YEAR) return false
  if (!Number.isFinite(o.amount) || Math.abs(o.amount) > MAX_ABS_AMOUNT) return false
  return true
}

export function distillSeasonalProfile(
  observations: ReadonlyArray<HistoryObservation>,
  opts: DistillOptions
): DistillResult {
  const valid = observations.filter(isValidObservation)
  if (valid.length === 0) {
    return { ok: false, error: 'No usable history observations were found.' }
  }

  // Sum + count per calendar month (1..12) so we can average across years.
  const sums = new Array<number>(MONTHS_IN_YEAR).fill(0)
  const counts = new Array<number>(MONTHS_IN_YEAR).fill(0)
  const years = new Set<number>()
  for (const o of valid) {
    const idx = o.month - 1
    sums[idx]! += Math.abs(o.amount)
    counts[idx]! += 1
    years.add(o.year)
  }

  const coveredMeans: number[] = []
  for (let i = 0; i < MONTHS_IN_YEAR; i++) {
    if (counts[i]! > 0) coveredMeans.push(sums[i]! / counts[i]!)
  }
  const monthsCovered = coveredMeans.length
  // Average of covered months — used to fill any month with no history.
  const fillValue = round2(coveredMeans.reduce((a, b) => a + b, 0) / monthsCovered)

  const baseline = new Array<number>(MONTHS_IN_YEAR)
  let filled = 0
  for (let i = 0; i < MONTHS_IN_YEAR; i++) {
    if (counts[i]! > 0) {
      baseline[i] = round2(sums[i]! / counts[i]!)
    } else {
      baseline[i] = fillValue
      filled += 1
    }
  }

  const warnings: string[] = []
  if (filled > 0) {
    warnings.push(
      `${filled} month${filled === 1 ? '' : 's'} had no history and ${filled === 1 ? 'was' : 'were'} set to the average of the ${monthsCovered} covered month${monthsCovered === 1 ? '' : 's'}.`
    )
  }

  const profile: SeasonalProfile = {
    baseline,
    source: 'import',
    years: years.size,
    computed_at: opts.computedAt,
    note: opts.note ?? ''
  }

  return { ok: true, profile, monthsCovered, observationsUsed: valid.length, warnings }
}
