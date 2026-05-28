import type { Tables } from '@/lib/supabase/database.types'
import { signedActivity } from '@/lib/finance/signedActivity'

type TxRow = Tables<'transactions'>

export type SortKey =
  | 'date'
  | 'description'
  | 'category'
  | 'account'
  | 'member'
  | 'amount'
  | 'type'
export type SortDir = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  dir: SortDir
}

const SORT_KEYS: ReadonlySet<string> = new Set([
  'date',
  'description',
  'category',
  'account',
  'member',
  'amount',
  'type'
])

/** Parse ?sort= + ?dir= into a SortState, or null when not a valid sort. */
export function parseSort(
  sortParam: string | null,
  dirParam: string | null
): SortState | null {
  if (!sortParam || !SORT_KEYS.has(sortParam)) return null
  const dir: SortDir = dirParam === 'asc' ? 'asc' : 'desc' // default desc
  return { key: sortParam as SortKey, dir }
}

/** Serialize a SortState to URLSearchParams entries (or nothing when null). */
export function serializeSort(
  sort: SortState | null,
  params: URLSearchParams
): void {
  if (!sort) return
  params.set('sort', sort.key)
  params.set('dir', sort.dir)
}

/** Case-insensitive text compare; returns 0 for two equal values. */
function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

/**
 * Deterministic secondary tiebreak: date DESC, then id ASC.
 * Keeps same-amount rows (e.g. recurring mortgage payments) in a stable,
 * newest-first order and makes test output deterministic.
 */
function tiebreak(a: TxRow, b: TxRow): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1 // date desc
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0 // id asc
}

/** Returns the comparable text for a text-based column, or null when empty. */
function textValue(row: TxRow, key: SortKey): string | null {
  let raw: string | null
  switch (key) {
    case 'description':
      raw = row.description
      break
    case 'category':
      raw = row.category
      break
    case 'account':
      raw = row.account
      break
    case 'member':
      raw = row.member
      break
    case 'type':
      raw = row.type
      break
    default:
      raw = null
  }
  if (raw == null) return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Comparator factory. Returns a stable comparator:
 * - primary: the chosen column in the chosen direction
 * - secondary tiebreak: date desc, then id asc (deterministic)
 *
 * Null/empty values always sort LAST regardless of direction (so a desc
 * sort doesn't bury real rows under a block of nulls at the top).
 */
export function transactionComparator(
  sort: SortState
): (a: TxRow, b: TxRow) => number {
  const { key, dir } = sort
  const flip = dir === 'desc' ? -1 : 1

  return (a, b) => {
    let primary = 0

    if (key === 'amount') {
      // amount is non-null in the schema, so no null handling needed.
      primary = (signedActivity(a) - signedActivity(b)) * flip
    } else if (key === 'date') {
      // ISO YYYY-MM-DD strings — lexicographic compare is chronological.
      if (a.date !== b.date) primary = (a.date < b.date ? -1 : 1) * flip
    } else {
      // Text columns: null/empty always sorts last regardless of direction.
      const av = textValue(a, key)
      const bv = textValue(b, key)
      if (av === null && bv === null) {
        primary = 0
      } else if (av === null) {
        return 1 // a (null) after b
      } else if (bv === null) {
        return -1 // b (null) after a
      } else {
        primary = compareText(av, bv) * flip
      }
    }

    if (primary !== 0) return primary
    return tiebreak(a, b)
  }
}

/** Convenience: returns a NEW sorted array (does not mutate input). */
export function sortTransactions(
  rows: ReadonlyArray<TxRow>,
  sort: SortState | null
): ReadonlyArray<TxRow> {
  if (!sort) return rows
  return [...rows].sort(transactionComparator(sort))
}
