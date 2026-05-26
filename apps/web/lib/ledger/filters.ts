import type { TransactionFilters } from '@/lib/data/keys'

/**
 * Local-only extension to TransactionFilters: free-text search applied
 * client-side post-fetch. The data layer doesn't know about `q` — it's
 * a post-filter on the result set.
 */
export interface LedgerFilters extends TransactionFilters {
  q?: string
}

/** Default: last 90 days, no other filters. */
export function defaultFilters(today: Date = new Date()): LedgerFilters {
  const end = new Date(today)
  const start = new Date(today)
  start.setDate(start.getDate() - 90)
  return {
    startDate: toIso(start),
    endDate: toIso(end)
  }
}

/** Build a LedgerFilters from a URLSearchParams. */
export function parseFiltersFromUrl(params: URLSearchParams): LedgerFilters {
  const out: LedgerFilters = {}
  const start = params.get('start')
  const end = params.get('end')
  const category = params.get('category')
  const account = params.get('account')
  const memberParam = params.get('member')
  const type = params.get('type')
  const q = params.get('q')
  const amountMin = params.get('amount_min')
  const amountMax = params.get('amount_max')

  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) out.startDate = start
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end)) out.endDate = end
  if (category) {
    out.categoryId = category === 'uncategorized' ? null : category
  }
  if (account) out.account = account
  if (memberParam !== null) {
    out.member = memberParam === '__unassigned__' ? null : memberParam
  }
  if (type === 'Income' || type === 'Expense' || type === 'Transfer' || type === 'Refund') {
    out.type = type
  }
  if (q) out.q = q
  if (amountMin !== null) {
    const n = Number(amountMin)
    if (Number.isFinite(n)) out.minAmount = n
  }
  if (amountMax !== null) {
    const n = Number(amountMax)
    if (Number.isFinite(n)) out.maxAmount = n
  }

  return out
}

/** Serialize a LedgerFilters back into a URLSearchParams instance. Empty values omitted. */
export function serializeFiltersToUrl(filters: LedgerFilters): URLSearchParams {
  const p = new URLSearchParams()
  if (filters.startDate) p.set('start', filters.startDate)
  if (filters.endDate) p.set('end', filters.endDate)
  if (filters.categoryId === null) p.set('category', 'uncategorized')
  else if (filters.categoryId) p.set('category', filters.categoryId)
  if (filters.account) p.set('account', filters.account)
  if (filters.member === null) p.set('member', '__unassigned__')
  else if (filters.member) p.set('member', filters.member)
  if (filters.type) p.set('type', filters.type)
  if (filters.q) p.set('q', filters.q)
  if (filters.minAmount !== undefined) p.set('amount_min', String(filters.minAmount))
  if (filters.maxAmount !== undefined) p.set('amount_max', String(filters.maxAmount))
  return p
}

/** Strip the `q` field — used to call useTransactions, which doesn't know about q. */
export function toDataFilters(filters: LedgerFilters): TransactionFilters {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { q, ...rest } = filters
  return rest
}

/** Returns true when no filters are set. */
export function isEmpty(filters: LedgerFilters): boolean {
  return (
    !filters.startDate && !filters.endDate &&
    filters.categoryId === undefined &&
    !filters.account && filters.member === undefined && !filters.type && !filters.q &&
    filters.minAmount === undefined &&
    filters.maxAmount === undefined
  )
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}
