/**
 * Post-insert auto-pairing for transfer_recognizer rules.
 *
 * Background: an AmEx CSV import yields rows like "MOBILE PAYMENT - THANK YOU"
 * that a transfer_recognizer rule has tagged with `pairAccountFilter='Citibank'`.
 * After those rows land in the `transactions` table, this pass:
 *   1. Looks up the partner accounts named by pairAccountFilter
 *   2. Queries for unpaired Transfer-type rows on those accounts with the
 *      same date and matching |amount| (opposite sign)
 *   3. Calls the existing `pair_transfer_rows` RPC for each pair found
 *
 * The pure piece — `planAutoPairs` — picks the best counterparty for each
 * imported row and returns a list of (rowAId, rowBId) pairs to feed the RPC.
 * The DB caller (`runAutoPairs`) is a thin async function around that plan.
 *
 * Conservative semantics: when more than one candidate matches, we pick the
 * EARLIEST-created candidate so re-running the import is idempotent and we
 * never grab a row the user paired by hand to a different partner.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Minimal shape we need from each imported row to plan pairs. */
export interface PairableImportedRow {
  id: string
  date: string
  amount: number
  pairAccountFilter: string
}

/** Minimal shape we need from each candidate row on the partner account. */
export interface PairCandidate {
  id: string
  date: string
  amount: number
  account_id: string
  created_at: string | null
}

export interface PairPlanEntry {
  /** Newly-imported row on the source account. */
  importedRowId: string
  /** Counterparty on the partner account. */
  partnerRowId: string
}

export interface PlanAutoPairsInput {
  importedRows: ReadonlyArray<PairableImportedRow>
  /** Pre-fetched candidate rows on accounts matching any pairAccountFilter. */
  candidates: ReadonlyArray<PairCandidate>
}

/**
 * Plan which imported rows pair with which candidates. Each candidate can be
 * consumed at most once. When multiple candidates qualify for the same
 * imported row, we pick the earliest-created (oldest) candidate — that keeps
 * the pass stable across re-runs and avoids stealing recently-created rows
 * the user might have paired by hand.
 *
 * Match criteria:
 *   - Same `date` (no fuzzy window — most bank ACH lands on the exact day)
 *   - `Math.abs(a.amount) === Math.abs(b.amount)`
 *   - Opposite signs
 */
export function planAutoPairs(input: PlanAutoPairsInput): ReadonlyArray<PairPlanEntry> {
  const plan: PairPlanEntry[] = []
  const consumed = new Set<string>()

  // Stable sort once so the per-row search runs against a deterministic order.
  const sortedCandidates = [...input.candidates].sort((a, b) => {
    const ac = a.created_at ?? ''
    const bc = b.created_at ?? ''
    if (ac !== bc) return ac < bc ? -1 : 1
    return a.id < b.id ? -1 : 1
  })

  for (const imp of input.importedRows) {
    const match = sortedCandidates.find(c => {
      if (consumed.has(c.id)) return false
      if (c.date !== imp.date) return false
      if (Math.abs(c.amount) !== Math.abs(imp.amount)) return false
      if (Math.sign(c.amount) === Math.sign(imp.amount)) return false
      return true
    })
    if (!match) continue
    consumed.add(match.id)
    plan.push({ importedRowId: imp.id, partnerRowId: match.id })
  }

  return plan
}

/**
 * Execute the auto-pair plan against Supabase: for each (imported, partner)
 * pair, call the `pair_transfer_rows` RPC. Errors on individual pairs are
 * collected; one failure does not abort the rest.
 */
export interface RunAutoPairsArgs {
  supabase: SupabaseClient
  householdId: string
  plan: ReadonlyArray<PairPlanEntry>
}

export interface RunAutoPairsResult {
  paired: number
  failed: ReadonlyArray<{ pair: PairPlanEntry; error: string }>
}

export async function runAutoPairs(args: RunAutoPairsArgs): Promise<RunAutoPairsResult> {
  const failed: { pair: PairPlanEntry; error: string }[] = []
  let paired = 0

  for (const entry of args.plan) {
    const { error } = await args.supabase.rpc('pair_transfer_rows', {
      p_household_id: args.householdId,
      p_row_a_id: entry.importedRowId,
      p_row_b_id: entry.partnerRowId
    })
    if (error) {
      failed.push({ pair: entry, error: error.message })
    } else {
      paired += 1
    }
  }

  return { paired, failed }
}

/**
 * Orchestrator: given the rows that were just imported and tagged with a
 * pair_account_filter, look up their new transaction IDs, fetch unpaired
 * counterparty candidates on the partner account, plan the pairs, and call
 * the RPC. Returns the count paired plus per-pair failures so the import
 * UI can surface them.
 *
 * Idempotent: a re-run finds nothing to pair because all the inserted rows
 * already have transfer_pair_id set.
 */
export interface PairableTaggedRow {
  /** Computed fingerprint we used at insert time. */
  fingerprint: string
  date: string
  amount: number
  pairAccountFilter: string
}

export interface RunImportAutoPairArgs {
  supabase: SupabaseClient
  householdId: string
  /** Account ID where the rows were inserted. */
  sourceAccountId: string
  /** Rows from the just-completed import that had pairAccountFilter set. */
  rows: ReadonlyArray<PairableTaggedRow>
}

export async function runImportAutoPair(args: RunImportAutoPairArgs): Promise<RunAutoPairsResult> {
  if (args.rows.length === 0) {
    return { paired: 0, failed: [] }
  }

  // 1. Resolve the just-inserted source rows by (account_id, fingerprint).
  //    We only consider unpaired rows so re-runs are safe.
  const fingerprints = Array.from(new Set(args.rows.map(r => r.fingerprint)))
  const { data: srcRows, error: srcErr } = await args.supabase
    .from('transactions')
    .select('id, date, amount, fingerprint')
    .eq('account_id', args.sourceAccountId)
    .in('fingerprint', fingerprints)
    .is('transfer_pair_id', null)
  if (srcErr) {
    return { paired: 0, failed: [{ pair: { importedRowId: '?', partnerRowId: '?' }, error: srcErr.message }] }
  }

  // Build a fingerprint -> { importedRowId, pairAccountFilter } map.
  // Pick the first matching row per fingerprint; uniqueness is enforced by
  // the import dedup pass that runs before insert.
  const filterByFingerprint = new Map<string, string>()
  for (const r of args.rows) filterByFingerprint.set(r.fingerprint, r.pairAccountFilter)

  // Group source IDs by pair_account_filter.
  const sourcesByFilter = new Map<string, PairableImportedRow[]>()
  for (const row of srcRows ?? []) {
    const filter = filterByFingerprint.get(row.fingerprint as string)
    if (!filter) continue
    const bucket = sourcesByFilter.get(filter) ?? []
    bucket.push({
      id: row.id as string,
      date: row.date as string,
      amount: row.amount as number,
      pairAccountFilter: filter
    })
    sourcesByFilter.set(filter, bucket)
  }

  if (sourcesByFilter.size === 0) {
    return { paired: 0, failed: [] }
  }

  // 2. For each filter, resolve the partner account(s) by name and fetch
  //    unpaired candidates in the date range.
  let totalPaired = 0
  const allFailed: { pair: PairPlanEntry; error: string }[] = []

  for (const [filterName, srcs] of sourcesByFilter.entries()) {
    const { data: partnerAccts } = await args.supabase
      .from('accounts')
      .select('id, name')
      .eq('name', filterName)
      .eq('is_active', true)
    const partnerIds = (partnerAccts ?? []).map(a => a.id as string)
    if (partnerIds.length === 0) continue

    const dates = Array.from(new Set(srcs.map(s => s.date))).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]
    if (!minDate || !maxDate) continue

    const { data: candidates } = await args.supabase
      .from('transactions')
      .select('id, date, amount, account_id, created_at')
      .in('account_id', partnerIds)
      .gte('date', minDate)
      .lte('date', maxDate)
      .is('transfer_pair_id', null)

    const plan = planAutoPairs({
      importedRows: srcs,
      candidates: (candidates ?? []).map(c => ({
        id: c.id as string,
        date: c.date as string,
        amount: c.amount as number,
        account_id: c.account_id as string,
        created_at: c.created_at as string | null
      }))
    })

    const result = await runAutoPairs({
      supabase: args.supabase,
      householdId: args.householdId,
      plan
    })
    totalPaired += result.paired
    allFailed.push(...result.failed)
  }

  return { paired: totalPaired, failed: allFailed }
}
