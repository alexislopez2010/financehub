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
