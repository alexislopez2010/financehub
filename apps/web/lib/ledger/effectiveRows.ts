/**
 * Expand transactions to "effective rows" honoring splits.
 *
 * Most surfaces aggregate transactions by member / category / runway flag.
 * When a transaction has splits, each split represents a piece with its own
 * member + category + exclude_from_runway. This helper produces ONE row per
 * split (parent suppressed), or ONE row per transaction (no splits).
 *
 * Use this anywhere you'd otherwise iterate `transactions`:
 *   const rows = expandToEffectiveRows({ transactions, splits })
 *   for (const r of rows) {
 *     // r.amount, r.member, r.category, r.exclude_from_runway are
 *     // automatically the split's values when the parent was split.
 *   }
 *
 * Do NOT use this for ACCOUNT-BALANCE math (lib/accounts/balances.ts), where
 * the parent.amount is the bank-confirmed truth. Splits sum to parent so
 * either approach yields the same total, but the parent path is closer to
 * the import audit trail.
 */

import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow      = Tables<'transactions'>
export type TransactionSplitRow = Tables<'transaction_splits'>

/**
 * One row of the expanded transaction stream. Carries forward the parent's
 * date/account/type/description/transfer state because those don't make sense
 * to split. The split's own metadata overrides amount/member/category/notes
 * and exclude_from_runway.
 */
export interface EffectiveRow {
  /** Parent transaction id. */
  readonly transactionId: string
  /** Split id when this row is a split; null when it's the unsplit parent. */
  readonly splitId: string | null
  readonly date: string
  readonly description: string
  readonly type: string
  readonly account: string | null
  readonly account_id: string | null
  /** Positive magnitude. Same sign convention as TransactionRow.amount. */
  readonly amount: number
  readonly member: string | null
  readonly category: string | null
  readonly category_id: string | null
  readonly sub_category: string | null
  readonly notes: string | null
  readonly exclude_from_runway: boolean
  readonly transfer_pair_id: string | null
}

export interface ExpandInput {
  transactions: ReadonlyArray<TransactionRow>
  splits: ReadonlyArray<TransactionSplitRow>
}

/**
 * Returns one EffectiveRow per (split or parent). Parents with at least one
 * split are SUPPRESSED — their splits replace them.
 */
export function expandToEffectiveRows(input: ExpandInput): ReadonlyArray<EffectiveRow> {
  // Index splits by parent id for O(1) lookup. Sort within parent by
  // display_order so the expanded stream is deterministic.
  const splitsByParent = new Map<string, TransactionSplitRow[]>()
  for (const s of input.splits) {
    let arr = splitsByParent.get(s.transaction_id)
    if (!arr) {
      arr = []
      splitsByParent.set(s.transaction_id, arr)
    }
    arr.push(s)
  }
  for (const arr of splitsByParent.values()) {
    arr.sort((a, b) => a.display_order - b.display_order)
  }

  const out: EffectiveRow[] = []
  for (const tx of input.transactions) {
    const splits = splitsByParent.get(tx.id)
    if (splits && splits.length > 0) {
      for (const s of splits) {
        out.push({
          transactionId: tx.id,
          splitId: s.id,
          date: tx.date,
          description: tx.description,
          type: tx.type,
          account: tx.account,
          account_id: tx.account_id,
          // Splits store positive magnitudes; preserve parent's sign convention.
          amount: tx.amount < 0 ? -s.amount : s.amount,
          member: s.member,
          category: s.category,
          category_id: s.category_id,
          sub_category: s.sub_category,
          notes: s.notes,
          // Per-split override; falls back to parent flag when null.
          exclude_from_runway: s.exclude_from_runway ?? tx.exclude_from_runway,
          transfer_pair_id: tx.transfer_pair_id
        })
      }
    } else {
      out.push({
        transactionId: tx.id,
        splitId: null,
        date: tx.date,
        description: tx.description,
        type: tx.type,
        account: tx.account,
        account_id: tx.account_id,
        amount: tx.amount,
        member: tx.member,
        category: tx.category,
        category_id: tx.category_id,
        sub_category: tx.sub_category,
        notes: tx.notes,
        exclude_from_runway: tx.exclude_from_runway,
        transfer_pair_id: tx.transfer_pair_id
      })
    }
  }
  return out
}

/**
 * Returns the set of parent transaction ids that have at least one split.
 * Cheap to compute; useful for "show split badge" decisions in the UI.
 */
export function splitParentIds(splits: ReadonlyArray<TransactionSplitRow>): ReadonlySet<string> {
  const set = new Set<string>()
  for (const s of splits) set.add(s.transaction_id)
  return set
}
