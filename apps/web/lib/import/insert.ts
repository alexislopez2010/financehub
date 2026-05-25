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
  fingerprint: string
}

function toInsertRow(
  r: ImportRow,
  householdId: string,
  accountId: string,
  accountName: string
): TransactionInsertRow {
  return {
    household_id: householdId,
    date: r.date,
    description: r.description,
    amount: r.amount,
    type: r.type,
    account: accountName,
    account_id: accountId,
    category_id: r.categoryId,
    fingerprint: r.fingerprint
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
 *   - member, payment_method, notes — left null
 *   - bill_id — no transactions.bill_id column; bill linkage stays
 *     informational at this stage (the bills surface matches by name+date)
 */
export async function insertImportedTransactions(args: InsertArgs): Promise<InsertResult> {
  const { supabase, rows, householdId, accountId, accountName, onProgress } = args

  if (rows.length === 0) {
    return { inserted: 0, failed: [] }
  }

  let inserted = 0
  const failed: InsertFailure[] = []

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const batch = rows.slice(i, i + CHUNK_SIZE)
    const payload = batch.map(r => toInsertRow(r, householdId, accountId, accountName))

    const { error } = await supabase.from('transactions').insert(payload)

    if (error) {
      // Fall back to per-row to identify the bad rows in this batch.
      for (const r of batch) {
        const { error: oneErr } = await supabase
          .from('transactions')
          .insert(toInsertRow(r, householdId, accountId, accountName))
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
