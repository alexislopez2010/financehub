/**
 * Reconciles over-budget spend against unplanned income variance.
 *
 * The Plan surface shows "over by $X" whenever actual spend exceeds the
 * household budget. That framing is technically correct but emotionally
 * misleading when unplanned income covered the extra spend — the
 * household may still be net-ahead for the month.
 *
 * This pure helper produces a short reconciliation line describing how
 * much of the over-budget amount was funded by unplanned income, so the
 * UI can subordinate the red "over by" line under a calmer (or sharper)
 * context line.
 */

export type ReconciliationTone = 'positive' | 'warning' | 'negative'

export interface OverBudgetReconciliation {
  /** Pre-formatted human-readable text, e.g. "funded by +$22,000 unplanned income — net unplanned: +$9,680 saved". */
  readonly text: string
  /** Tailwind/text tone classification for the sub-line. */
  readonly tone: ReconciliationTone
}

export interface ReconciliationInput {
  /** How much actual spend exceeds the household budget (always >= 0). */
  readonly overBudgetAmount: number
  /** Unplanned income variance: actualIncome - plannedIncome. Can be negative. */
  readonly incomeVariance: number
}

function formatUSD(n: number): string {
  return Math.abs(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

/**
 * Returns the reconciliation sub-line for the BudgetSection header, or
 * `null` if there is no over-budget condition to reconcile.
 *
 * Rules:
 * - `overBudgetAmount <= 0`: returns null (no sub-line; the parent
 *   header already suppresses the "over by" line in that case).
 * - `incomeVariance >= overBudgetAmount`: the overage was fully funded
 *   by unplanned income. Tone is positive.
 * - `0 < incomeVariance < overBudgetAmount`: partial coverage. Tone is
 *   warning.
 * - `incomeVariance <= 0`: no unplanned income to cover. Tone is
 *   negative.
 */
export function computeOverBudgetReconciliation(
  input: ReconciliationInput
): OverBudgetReconciliation | null {
  const { overBudgetAmount, incomeVariance } = input

  if (overBudgetAmount <= 0) return null

  if (incomeVariance >= overBudgetAmount) {
    const netUnplanned = incomeVariance - overBudgetAmount
    return {
      text: `funded by +${formatUSD(incomeVariance)} unplanned income — net unplanned: +${formatUSD(netUnplanned)} saved`,
      tone: 'positive'
    }
  }

  if (incomeVariance > 0) {
    const unfunded = overBudgetAmount - incomeVariance
    return {
      text: `+${formatUSD(incomeVariance)} unplanned income partially covers — ${formatUSD(unfunded)} unfunded overspend`,
      tone: 'warning'
    }
  }

  return {
    text: `no unplanned income to cover — ${formatUSD(overBudgetAmount)} truly over plan`,
    tone: 'negative'
  }
}
