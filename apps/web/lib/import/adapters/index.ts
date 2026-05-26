import { amex } from './amex'
import { capitalOne } from './capitalOne'
import { chase } from './chase'
import { citibank } from './citibank'
import { discover } from './discover'
import { generic } from './generic'
import type { Adapter } from './types'

/**
 * Adapter detection order: bank-specific first, generic last. First match wins.
 *
 * AmEx and Discover both have generic-looking headers; we put the specific
 * ones (Chase, Capital One, Citibank) first because their signatures are most
 * distinct.
 */
export const ADAPTERS: ReadonlyArray<Adapter> = [chase, capitalOne, citibank, discover, amex, generic]

export function detectAdapter(headers: ReadonlyArray<string>): Adapter | null {
  for (const a of ADAPTERS) {
    if (a.matches(headers)) return a
  }
  return null
}

export { amex, capitalOne, chase, citibank, discover, generic }
export type { Adapter, AdapterParseResult, ImportRow, ParsedImportRow, SkippedRow, TransactionType } from './types'
