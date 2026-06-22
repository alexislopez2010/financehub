/**
 * Three-tier spend taxonomy.
 *
 *   essential      — non-negotiable floor: mortgage, car, insurance, utilities, groceries.
 *   services       — recurring but cancellable: subscriptions, memberships.
 *   discretionary  — variable non-committed spend: dining, shopping, entertainment.
 *
 * Resolution precedence (the Forecast surface lets the user override either level):
 *   1. bills.tier      (most specific)
 *   2. categories.tier
 *   3. auto-derived heuristic (below)
 */

export type SpendTier = 'essential' | 'services' | 'discretionary'

const SPEND_TIERS = new Set<string>(['essential', 'services', 'discretionary'])

/**
 * Narrows an untrusted value to a SpendTier. The DB types `categories.tier`
 * and `bills.tier` as `string | null`; callers reading a tier from the DB use
 * this guard instead of an unsafe cast.
 */
export function isSpendTier(v: unknown): v is SpendTier {
  return typeof v === 'string' && SPEND_TIERS.has(v)
}

export interface ResolveTierInput {
  /** bills.tier override, or null. */
  billTier: SpendTier | null
  /** categories.tier override, or null. */
  categoryTier: SpendTier | null
  /** categories.is_fixed for the item's category. */
  isFixed: boolean | null
  /** True if the bill has linked_debt_id set (mortgage / car / loan obligation). */
  hasLinkedDebt: boolean
  /** True if this spend line corresponds to a named bill. */
  hasBill: boolean
}

export function resolveTier(input: ResolveTierInput): SpendTier {
  if (input.billTier) return input.billTier
  if (input.categoryTier) return input.categoryTier
  // Auto heuristic:
  if (input.isFixed === true) return 'essential'
  if (input.hasLinkedDebt) return 'essential'
  if (input.hasBill) return 'services'
  return 'discretionary'
}
