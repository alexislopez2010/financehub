import type { BillRow, BillMatchRule, TransactionRow } from './types'

export interface BillMatchResult {
  bill: BillRow
  matchedTransactions: ReadonlyArray<TransactionRow>
  totalAmount: number  // sum of matched transaction amounts (positive number — abs)
  count: number
}

/**
 * Returns true if a single transaction matches a single bill rule.
 *
 * Matching semantics (mirrors legacy Dashboard.jsx:2266-2288):
 *
 *   rule_kind = 'category_map'
 *     - rule.category required; matches when transaction.category === rule.category
 *     - if rule.sub_category set, transaction.description must contain it (case-insensitive)
 *       OR the transaction's category_id resolves to one whose name matches (out of scope here —
 *       we use the simpler description-contains rule the legacy app used)
 *     - if rule.keyword set, transaction.description must contain it (case-insensitive)
 *     - if rule.account_filter set, transaction.account must equal it
 *
 *   rule_kind = 'name_keyword'
 *     - rule.keyword required; transaction.description must contain it (case-insensitive)
 *     - if rule.account_filter set, transaction.account must equal it
 */
export function transactionMatchesRule(
  tx: Pick<TransactionRow, 'description' | 'category' | 'account'>,
  rule: BillMatchRule
): boolean {
  const desc = (tx.description ?? '').toLowerCase()

  if (rule.account_filter != null && tx.account !== rule.account_filter) {
    return false
  }

  if (rule.rule_kind === 'category_map') {
    if (rule.category == null) return false
    if (tx.category !== rule.category) return false
    if (rule.sub_category != null && !desc.includes(rule.sub_category.toLowerCase())) {
      // Some legacy rules used sub_category as a description filter when there was no separate
      // sub_category column on transactions. We honor that here.
      return false
    }
    if (rule.keyword != null && !desc.includes(rule.keyword.toLowerCase())) {
      return false
    }
    return true
  }

  // rule_kind === 'name_keyword'
  if (rule.keyword == null) return false
  return desc.includes(rule.keyword.toLowerCase())
}

/**
 * Matches every bill against the transaction set using the supplied rules.
 * A bill matches a transaction if ANY of its rules matches (union).
 *
 * Rules are associated with a bill by either:
 *   - rule.bill_id === bill.id, OR
 *   - rule.bill_name === bill.name (fallback for unresolved rules)
 *
 * Inactive bills (is_active === false) are skipped entirely (returned with
 * empty match arrays).
 *
 * Returns one result per input bill, in the same order.
 */
export function matchBills(
  bills: ReadonlyArray<BillRow>,
  transactions: ReadonlyArray<TransactionRow>,
  rules: ReadonlyArray<BillMatchRule>
): ReadonlyArray<BillMatchResult> {
  return bills.map(bill => {
    if (!bill.is_active) {
      return { bill, matchedTransactions: [], totalAmount: 0, count: 0 }
    }

    const billRules = rules.filter(
      r => r.bill_id === bill.id || (r.bill_id == null && r.bill_name === bill.name)
    )

    if (billRules.length === 0) {
      return { bill, matchedTransactions: [], totalAmount: 0, count: 0 }
    }

    const matched = transactions.filter(tx =>
      billRules.some(rule => transactionMatchesRule(tx, rule))
    )

    const totalAmount = matched.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)

    return {
      bill,
      matchedTransactions: matched,
      totalAmount,
      count: matched.length
    }
  })
}
