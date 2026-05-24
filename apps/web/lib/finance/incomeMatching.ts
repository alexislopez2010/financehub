import type { IncomePlanRow, TransactionRow } from './types'

export interface IncomeMatchResult {
  /** Source name, e.g. "Omnicom Shared Services". */
  source: string
  /** Members associated with this source in the plan (deduped). */
  members: ReadonlyArray<string>
  /** Sum of expected_amount across active plan rows for this source in the period. */
  planned: number
  /** Sum of matched income transactions' absolute amounts in the period. */
  actual: number
  /** The matched transactions (deterministic order: input order). */
  transactions: ReadonlyArray<TransactionRow>
}

export interface IncomeMatchOptions {
  /** Filter plan rows by year. */
  year: number
  /** Filter plan rows by months (1..12). Pass [m] for a single month or all
   *  12 for YTD. */
  months: ReadonlyArray<number>
}

/**
 * Derives lowercase keywords from a source name, splitting on any non-word
 * character. Drops empty tokens. Used for fuzzy matching against transaction
 * descriptions.
 *
 *   sourceKeywords("Omnicom Shared Services") → ["omnicom","shared","services"]
 *   sourceKeywords("J. Crew Group, Inc.")     → ["j","crew","group","inc"]
 *   sourceKeywords("")                         → []
 */
export function sourceKeywords(source: string): ReadonlyArray<string> {
  return source.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 0)
}

/**
 * Returns true if the transaction description contains ANY of the source's
 * keywords (case-insensitive, substring match). Matches the legacy behavior
 * which used `keywords.some(k => description.includes(k))`.
 *
 * Edge cases:
 *   - source with no keywords (empty or punctuation-only) → never matches.
 *   - transaction.description null → never matches.
 */
export function transactionMatchesSource(
  tx: Pick<TransactionRow, 'description'>,
  keywords: ReadonlyArray<string>
): boolean {
  if (keywords.length === 0) return false
  const desc = (tx.description ?? '').toLowerCase()
  if (desc.length === 0) return false
  return keywords.some(k => desc.includes(k.toLowerCase()))
}

/**
 * Per-source planned-vs-actual income matching for a period.
 *
 * Plan aggregation:
 *   - Filter plan rows by year, months IN options.months, AND is_active === true.
 *   - Group by source (string-equality). Sum expected_amount; collect distinct members.
 *
 * Transaction matching:
 *   - Only Income transactions in the period are considered.
 *     (Period = date.year === options.year AND date.month IN options.months)
 *   - For each transaction, find the FIRST source (in plan-aggregation order)
 *     whose keywords match. If found, attach the transaction to that source.
 *   - Transactions not matched to any source land in a synthetic "Uncategorized"
 *     source ONLY IF there were any unmatched txs. Otherwise omitted.
 *
 * Result ordering: planned-source order (insertion order of first occurrence),
 * with "Uncategorized" last when present.
 */
export function matchIncome(
  plan: ReadonlyArray<IncomePlanRow>,
  transactions: ReadonlyArray<TransactionRow>,
  options: IncomeMatchOptions
): ReadonlyArray<IncomeMatchResult> {
  const monthSet = new Set(options.months)

  // 1. Aggregate planned by source.
  type PlanAgg = { source: string; members: Set<string>; planned: number; keywords: ReadonlyArray<string> }
  const planBySource = new Map<string, PlanAgg>()

  for (const row of plan) {
    if (!row.is_active) continue
    if (row.year !== options.year) continue
    if (!monthSet.has(row.month)) continue
    const source = row.source ?? 'Other'
    let agg = planBySource.get(source)
    if (!agg) {
      agg = {
        source,
        members: new Set<string>(),
        planned: 0,
        keywords: sourceKeywords(source)
      }
      planBySource.set(source, agg)
    }
    if (row.member) agg.members.add(row.member)
    agg.planned += row.expected_amount
  }

  // 2. Filter Income transactions in the period.
  const periodTxs = transactions.filter(tx => {
    if (tx.type !== 'Income') return false
    const d = new Date(tx.date + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return false
    if (d.getUTCFullYear() !== options.year) return false
    const month = d.getUTCMonth() + 1
    return monthSet.has(month)
  })

  // 3. For each tx, find the first matching source.
  const matchedBySource = new Map<string, TransactionRow[]>()
  const unmatched: TransactionRow[] = []

  for (const tx of periodTxs) {
    let matched = false
    for (const agg of planBySource.values()) {
      if (transactionMatchesSource(tx, agg.keywords)) {
        let list = matchedBySource.get(agg.source)
        if (!list) {
          list = []
          matchedBySource.set(agg.source, list)
        }
        list.push(tx)
        matched = true
        break  // first match wins
      }
    }
    if (!matched) unmatched.push(tx)
  }

  // 4. Build the results.
  const results: IncomeMatchResult[] = []
  for (const agg of planBySource.values()) {
    const txs = matchedBySource.get(agg.source) ?? []
    const actual = txs.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    results.push({
      source: agg.source,
      members: Array.from(agg.members),
      planned: agg.planned,
      actual,
      transactions: txs
    })
  }

  if (unmatched.length > 0) {
    const actual = unmatched.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    results.push({
      source: 'Uncategorized',
      members: [],
      planned: 0,
      actual,
      transactions: unmatched
    })
  }

  return results
}
