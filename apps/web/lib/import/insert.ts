/**
 * Bulk-insert helper for the import flow.
 *
 * Maps ImportRow → transactions Insert shape and pushes rows in batches.
 * When a batch fails, we fall back to per-row inserts so we can identify
 * exactly which row(s) failed and surface them to the user.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportRow } from './adapters/types'

/** Batch size for the initial bulk insert. */
const CHUNK_SIZE = 100

export interface InsertFailure {
  row: ImportRow
  error: string
}

export interface InsertResult {
  inserted: number
  failed: ReadonlyArray<InsertFailure>
}

export interface InsertArgs {
  supabase: SupabaseClient
  rows: ReadonlyArray<ImportRow>
  householdId: string
  accountId: string
  accountName: string
  /**
   * Pre-selected member to write into the `member` column on every imported
   * row. null = unassigned (the existing data default). 'Family' is the
   * literal string used for shared expenses.
   */
  member: string | null
  /**
   * Map of category id → name. When supplied, the importer also writes
   * `category` (text) alongside `category_id` for any row with a categoryId.
   * Without this, downstream surfaces that bucket on the text field —
   * spendByCategory, deriveBudgetVsActual, autoCategorize's "uncategorized"
   * detection — would treat the row as uncategorized even though the FK is set.
   * Default to an empty Map when omitted; existing callers stay safe.
   */
  categoryById?: ReadonlyMap<string, string>
  /** Optional progress callback fired after each batch resolves. */
  onProgress?: (inserted: number, total: number) => void
}

interface TransactionInsertRow {
  household_id: string
  date: string
  description: string
  amount: number
  type: string
  account: string
  account_id: string
  category_id: string | null
  category: string | null
  fingerprint: string
  member: string | null
}

function toInsertRow(
  r: ImportRow,
  householdId: string,
  accountId: string,
  accountName: string,
  member: string | null,
  categoryById: ReadonlyMap<string, string>
): TransactionInsertRow {
  // Resolve the category name from the FK so any future read of `category`
  // (text) agrees with `category_id`. Bucketing surfaces (spendByCategory,
  // deriveBudgetVsActual, etc.) read the text field — they shouldn't have
  // to also look up the name from a categories list.
  const categoryName = r.categoryId ? (categoryById.get(r.categoryId) ?? null) : null
  return {
    household_id: householdId,
    date: r.date,
    description: r.description,
    amount: r.amount,
    type: r.type,
    account: accountName,
    account_id: accountId,
    category_id: r.categoryId,
    category: categoryName,
    fingerprint: r.fingerprint,
    member
  }
}

/**
 * Bulk-insert import rows into the transactions table.
 *
 * - Chunks the rows into batches of 100
 * - Each batch goes as a single Supabase .insert() call
 * - On a batch failure, falls back to per-row inserts within that batch
 *   so we know exactly which row(s) failed
 * - Returns counts + per-row errors
 *
 * Does NOT set:
 *   - category (text) — new schema uses category_id only on insert
 *   - payment_method, notes — left null
 *   - bill_id — no transactions.bill_id column; bill linkage stays
 *     informational at this stage (the bills surface matches by name+date)
 *
 * `member` IS set per call from args.member (per-file default chosen at
 * upload time). null = unassigned.
 */
export async function insertImportedTransactions(args: InsertArgs): Promise<InsertResult> {
  const { supabase, rows, householdId, accountId, accountName, member, onProgress } = args
  const categoryById = args.categoryById ?? new Map<string, string>()

  if (rows.length === 0) {
    return { inserted: 0, failed: [] }
  }

  let inserted = 0
  const failed: InsertFailure[] = []

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const batch = rows.slice(i, i + CHUNK_SIZE)
    const payload = batch.map(r => toInsertRow(r, householdId, accountId, accountName, member, categoryById))

    const { error } = await supabase.from('transactions').insert(payload)

    if (error) {
      // Fall back to per-row to identify the bad rows in this batch.
      for (const r of batch) {
        const { error: oneErr } = await supabase
          .from('transactions')
          .insert(toInsertRow(r, householdId, accountId, accountName, member, categoryById))
        if (oneErr) {
          failed.push({ row: r, error: oneErr.message })
        } else {
          inserted += 1
        }
      }
    } else {
      inserted += batch.length
    }

    onProgress?.(inserted, rows.length)
  }

  return { inserted, failed }
}
