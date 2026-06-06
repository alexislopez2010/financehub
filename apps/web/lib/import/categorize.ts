/**
 * Enriches ImportRows with billId and categoryId based on bill_match_rules.
 *
 * Pure — caller fetches rules + bills + categories from Supabase first.
 *
 * Rule semantics (mirrors lib/finance/billsMatch.ts):
 *   - rule_kind = 'name_keyword': description.toLowerCase().includes(rule.keyword)
 *   - rule_kind = 'category_map':
 *       requires rule.category set;
 *       since incoming rows from CSV don't yet have category, this kind
 *       degrades to a keyword filter when rule.keyword/sub_category is set,
 *       otherwise it cannot match an incoming uncategorized row.
 *   - rule_kind = 'transfer_recognizer': matches like name_keyword AND
 *       overrides row.type with rule.tx_type_override (must be set). Also
 *       surfaces pair_account_filter on the output row so the post-insert
 *       auto-pair step can find the counterparty on the linked account.
 *
 * On a match:
 *   - billId = matched bill's id (if a bill is linked to the rule)
 *   - categoryId = resolved by matching the bill's category text against
 *     the categories list (case-insensitive). Falls back to rule.category
 *     mapping if the bill has no category. Null if nothing resolves.
 *   - type = rule.tx_type_override (when set) — only `transfer_recognizer`
 *     rules use this in practice.
 *   - pairAccountFilter = rule.pair_account_filter (when set).
 *
 * First-match-wins semantics: rules are evaluated in input order.
 */

import type { ImportRow, TransactionType } from './adapters/types'

const VALID_TX_TYPES: ReadonlySet<TransactionType> = new Set<TransactionType>([
  'Income', 'Expense', 'Transfer', 'Refund'
])

export interface CategorizeRule {
  id: string
  bill_id: string | null
  bill_name: string | null
  rule_kind: string  // 'category_map' | 'name_keyword' | 'transfer_recognizer'
  keyword: string | null
  sub_category: string | null
  category: string | null
  account_filter: string | null
  /** When set, a matching row gets this `type` instead of the adapter's. */
  tx_type_override: string | null
  /** Where the post-insert auto-pairer should look for a counterparty. */
  pair_account_filter: string | null
}

export interface CategorizeBill {
  id: string
  name: string
  category: string | null
}

export interface CategorizeCategory {
  id: string
  name: string
}

/**
 * Returns true if the rule matches the given import row.
 * Used internally; exported for tests.
 */
export function ruleMatchesRow(rule: CategorizeRule, row: ImportRow): boolean {
  const desc = row.description.toLowerCase()

  // account_filter compares against an account text name. Incoming ImportRows
  // don't carry the account on the row itself (caller selects the account
  // separately), so a rule with account_filter set conservatively does NOT
  // match here. The caller can apply account-aware categorization at a higher
  // level if needed.
  if (rule.account_filter != null) {
    return false
  }

  if (rule.rule_kind === 'name_keyword' || rule.rule_kind === 'transfer_recognizer') {
    if (!rule.keyword) return false
    return desc.includes(rule.keyword.toLowerCase())
  }

  if (rule.rule_kind === 'category_map') {
    // Incoming rows don't have a category yet — fall back to keyword/sub_category
    // matching so the rule can still produce a bill match for new imports.
    if (rule.keyword && !desc.includes(rule.keyword.toLowerCase())) return false
    if (rule.sub_category && !desc.includes(rule.sub_category.toLowerCase())) return false
    // Require AT LEAST one description hint, otherwise the rule is too broad.
    return Boolean(rule.keyword || rule.sub_category)
  }

  return false
}

function resolveCategoryId(
  rule: CategorizeRule,
  bill: CategorizeBill | undefined,
  categories: ReadonlyArray<CategorizeCategory>
): string | null {
  const candidates: string[] = []
  if (bill?.category) candidates.push(bill.category)
  if (rule.category) candidates.push(rule.category)

  for (const name of candidates) {
    const target = name.trim().toLowerCase()
    if (!target) continue
    const match = categories.find(c => c.name.trim().toLowerCase() === target)
    if (match) return match.id
  }
  return null
}

export interface CategorizeInput {
  rows: ReadonlyArray<ImportRow>
  rules: ReadonlyArray<CategorizeRule>
  bills: ReadonlyArray<CategorizeBill>
  categories: ReadonlyArray<CategorizeCategory>
}

export function categorize(input: CategorizeInput): ReadonlyArray<ImportRow> {
  const { rows, rules, bills, categories } = input

  const billsById = new Map(bills.map(b => [b.id, b]))
  const billsByName = new Map(bills.map(b => [b.name.trim().toLowerCase(), b]))

  return rows.map(row => {
    for (const rule of rules) {
      if (!ruleMatchesRow(rule, row)) continue

      let bill: CategorizeBill | undefined
      if (rule.bill_id) {
        bill = billsById.get(rule.bill_id)
      } else if (rule.bill_name) {
        bill = billsByName.get(rule.bill_name.trim().toLowerCase())
      }

      const categoryId = resolveCategoryId(rule, bill, categories)

      // Honor tx_type_override (used by transfer_recognizer rules). Guard
      // against invalid values that could slip past the DB CHECK due to
      // legacy rows or hand-inserts.
      const overrideType =
        rule.tx_type_override && VALID_TX_TYPES.has(rule.tx_type_override as TransactionType)
          ? (rule.tx_type_override as TransactionType)
          : null

      return {
        ...row,
        billId: bill?.id ?? null,
        categoryId,
        ...(overrideType ? { type: overrideType } : {}),
        ...(rule.pair_account_filter ? { pairAccountFilter: rule.pair_account_filter } : {})
      }
    }

    // No rule matched — return the row unchanged.
    return row
  })
}
