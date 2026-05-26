import type { Tables } from '@/lib/supabase/database.types'

type TxLike = Pick<Tables<'transactions'>, 'amount' | 'type'>

/**
 * Canonical "direction of money" for a transaction.
 *
 * The legacy Excel importer stored magnitudes in `amount` and used `type`
 * to indicate direction. The new bank-CSV importer stores signed amounts.
 * This helper unifies both conventions into the same signed result:
 *
 *   type='Income' | 'Refund' → +|amount|
 *   type='Expense'           → -|amount|
 *   type='Transfer'          →  amount (raw — the sign is already meaningful
 *                                       per the transfer_pair_id convention)
 *
 * Use this for display, tone, and any income-vs-expense bucketing across
 * the Ledger, Briefing, and any future report.
 */
export function signedActivity(tx: TxLike): number {
  if (tx.type === 'Income' || tx.type === 'Refund') return Math.abs(tx.amount)
  if (tx.type === 'Expense') return -Math.abs(tx.amount)
  return tx.amount
}

/**
 * Bucket a transaction into 'in' | 'out' | 'transfer' for footer / report math.
 * Transfers explicitly return 'transfer' because they shouldn't count in
 * either income or expense totals (the money is just moving).
 */
export type ActivityDirection = 'in' | 'out' | 'transfer'

export function activityDirection(tx: TxLike): ActivityDirection {
  if (tx.type === 'Transfer') return 'transfer'
  const signed = signedActivity(tx)
  if (signed > 0) return 'in'
  if (signed < 0) return 'out'
  return 'out' // 0-amount edge: arbitrary, but doesn't change totals
}
