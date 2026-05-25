/**
 * Pure cross-surface scorer for the Spotlight palette.
 *
 * Pure data in → scored hits out. No I/O, no React, no Supabase, no clock.
 *
 * Row types are narrowed `Pick<>`-style subsets of the data-layer rows
 * (apps/web/lib/data/*.ts) — we only declare the fields we actually read.
 * Each narrowed row is structurally compatible with the corresponding
 * Tables<'…'> row from supabase/database.types.ts (with one rename:
 * account.type → account_type for readability).
 */

export type SpotlightHitKind = 'transaction' | 'bill' | 'account' | 'category'

export interface SpotlightHit {
  readonly kind: SpotlightHitKind
  readonly id: string
  readonly label: string
  readonly detail?: string
  readonly href: string
  readonly score: number
}

// ── Narrowed row types ──────────────────────────────────────────────────────

/** Narrowed copy of Tables<'transactions'>. */
export interface TransactionRow {
  readonly id: string
  readonly description: string
  readonly category: string | null
  readonly category_id: string | null
  readonly account: string | null
  readonly member: string | null
  readonly date: string
  readonly amount: number
  readonly type: string
}

/** Narrowed copy of Tables<'bills'>. */
export interface BillRow {
  readonly id: string
  readonly name: string
  readonly category: string | null
  readonly frequency: string | null
  readonly due_day: number | null
  readonly budget_amount: number
}

/**
 * Narrowed copy of Tables<'accounts'>. The DB column is `type`; we rename
 * to `account_type` here so the consumer doesn't have to read a column
 * called "type" alongside a kind discriminator.
 */
export interface AccountRow {
  readonly id: string
  readonly name: string
  readonly institution: string | null
  readonly account_type: string | null
}

/** Narrowed copy of Tables<'categories'>. */
export interface CategoryRow {
  readonly id: string
  readonly name: string
}

export interface SpotlightCorpus {
  readonly transactions: ReadonlyArray<TransactionRow>
  readonly bills: ReadonlyArray<BillRow>
  readonly accounts: ReadonlyArray<AccountRow>
  readonly categories: ReadonlyArray<CategoryRow>
}

// ── Caps ────────────────────────────────────────────────────────────────────

const TRANSACTION_CAP = 8
const BILL_CAP = 5
const ACCOUNT_CAP = 5
const CATEGORY_CAP = 5

// ── Public entry point ──────────────────────────────────────────────────────

export function searchEverything(
  corpus: SpotlightCorpus,
  query: string
): ReadonlyArray<SpotlightHit> {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const txHits = scoreTransactions(corpus.transactions, tokens, query)
  const billHits = scoreBills(corpus.bills, tokens)
  const accountHits = scoreAccounts(corpus.accounts, tokens)
  const categoryHits = scoreCategories(corpus.categories, tokens)

  return [
    ...takeTop(txHits, TRANSACTION_CAP),
    ...takeTop(billHits, BILL_CAP),
    ...takeTop(accountHits, ACCOUNT_CAP),
    ...takeTop(categoryHits, CATEGORY_CAP)
  ]
}

// ── Tokenization + scoring primitives ───────────────────────────────────────

function tokenize(query: string): ReadonlyArray<string> {
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 0)
}

/**
 * For each token, find the shortest field that contains it. Returns the
 * accumulated score plus the set of field keys that contributed a match.
 * Returns null if any token has no match (AND semantics).
 */
interface MatchResult {
  readonly score: number
  readonly matchedFields: ReadonlySet<string>
}

function scoreRow(
  fields: ReadonlyArray<readonly [key: string, value: string | null | undefined]>,
  tokens: ReadonlyArray<string>
): MatchResult | null {
  // Pre-lowercase non-empty fields once per row.
  const lowered: Array<{ key: string; value: string }> = []
  for (const [key, value] of fields) {
    if (value == null) continue
    const v = String(value)
    if (v.length === 0) continue
    lowered.push({ key, value: v.toLowerCase() })
  }
  if (lowered.length === 0) return null

  let totalScore = 0
  const matchedFields = new Set<string>()

  for (const token of tokens) {
    let bestRatio = 0
    let bestKey: string | null = null
    for (const { key, value } of lowered) {
      if (!value.includes(token)) continue
      const ratio = token.length / value.length
      if (ratio > bestRatio) {
        bestRatio = ratio
        bestKey = key
      }
    }
    if (bestKey === null) return null
    totalScore += bestRatio
    matchedFields.add(bestKey)
  }

  return { score: totalScore, matchedFields }
}

function takeTop(
  hits: ReadonlyArray<SpotlightHit>,
  cap: number
): ReadonlyArray<SpotlightHit> {
  const sorted = [...hits].sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return a.label.localeCompare(b.label)
  })
  return sorted.slice(0, cap)
}

// ── Per-kind scoring ────────────────────────────────────────────────────────

function scoreTransactions(
  rows: ReadonlyArray<TransactionRow>,
  tokens: ReadonlyArray<string>,
  fullQuery: string
): ReadonlyArray<SpotlightHit> {
  const hits: SpotlightHit[] = []
  for (const tx of rows) {
    const fields: ReadonlyArray<readonly [string, string | null]> = [
      ['description', tx.description],
      ['category', tx.category],
      ['account', tx.account],
      ['member', tx.member]
    ]
    const match = scoreRow(fields, tokens)
    if (!match) continue

    // Pick the deep-link query: the first token that hit the description,
    // else fall back to the full original query.
    const descLower = tx.description.toLowerCase()
    const matchedToken = tokens.find(t => descLower.includes(t))
    const linkValue = matchedToken ?? fullQuery
    const href = `/ledger?q=${encodeURIComponent(linkValue)}`

    hits.push({
      kind: 'transaction',
      id: tx.id,
      label: tx.description,
      detail: formatTxDetail(tx),
      href,
      score: match.score
    })
  }
  return hits
}

function scoreBills(
  rows: ReadonlyArray<BillRow>,
  tokens: ReadonlyArray<string>
): ReadonlyArray<SpotlightHit> {
  const hits: SpotlightHit[] = []
  for (const bill of rows) {
    const fields: ReadonlyArray<readonly [string, string | null]> = [
      ['name', bill.name],
      ['category', bill.category],
      ['frequency', bill.frequency]
    ]
    const match = scoreRow(fields, tokens)
    if (!match) continue
    hits.push({
      kind: 'bill',
      id: bill.id,
      label: bill.name,
      detail: formatBillDetail(bill),
      href: `/bills?focus=${bill.id}`,
      score: match.score
    })
  }
  return hits
}

function scoreAccounts(
  rows: ReadonlyArray<AccountRow>,
  tokens: ReadonlyArray<string>
): ReadonlyArray<SpotlightHit> {
  const hits: SpotlightHit[] = []
  for (const acct of rows) {
    const fields: ReadonlyArray<readonly [string, string | null]> = [
      ['name', acct.name],
      ['institution', acct.institution],
      ['account_type', acct.account_type]
    ]
    const match = scoreRow(fields, tokens)
    if (!match) continue
    const detail = formatAccountDetail(acct)
    const base = {
      kind: 'account' as const,
      id: acct.id,
      label: acct.name,
      href: `/accounts?focus=${acct.id}`,
      score: match.score
    }
    hits.push(detail === undefined ? base : { ...base, detail })
  }
  return hits
}

function scoreCategories(
  rows: ReadonlyArray<CategoryRow>,
  tokens: ReadonlyArray<string>
): ReadonlyArray<SpotlightHit> {
  const hits: SpotlightHit[] = []
  for (const cat of rows) {
    const fields: ReadonlyArray<readonly [string, string | null]> = [
      ['name', cat.name]
    ]
    const match = scoreRow(fields, tokens)
    if (!match) continue
    hits.push({
      kind: 'category',
      id: cat.id,
      label: cat.name,
      href: `/ledger?category=${cat.id}`,
      score: match.score
    })
  }
  return hits
}

// ── Detail formatters ───────────────────────────────────────────────────────

const MONTH_NAMES: ReadonlyArray<string> = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

function formatTxDetail(tx: TransactionRow): string {
  return `${formatMonthDay(tx.date)} · ${formatSignedAmount(tx.amount)}`
}

function formatMonthDay(isoDate: string): string {
  // Expecting YYYY-MM-DD. Parse defensively without timezone conversion.
  const parts = isoDate.split('-')
  if (parts.length < 3) return isoDate
  const monthIdx = Number(parts[1]) - 1
  const day = Number(parts[2])
  if (!Number.isFinite(monthIdx) || monthIdx < 0 || monthIdx > 11) return isoDate
  if (!Number.isFinite(day)) return isoDate
  return `${MONTH_NAMES[monthIdx]} ${day}`
}

function formatSignedAmount(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  // Two-decimal, thousands-separated. Use Intl for locale-stable formatting.
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${sign}$${body}`
}

function formatBillDetail(bill: BillRow): string {
  const freq = bill.frequency ?? '—'
  const day = bill.due_day ?? '—'
  return `${freq} · day ${day}`
}

function formatAccountDetail(acct: AccountRow): string | undefined {
  if (acct.institution && acct.institution.length > 0) return acct.institution
  if (acct.account_type && acct.account_type.length > 0) return acct.account_type
  return undefined
}
