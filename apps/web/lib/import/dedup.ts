import type { ImportRow } from './adapters/types'

export interface DedupResult {
  /** Rows whose fingerprint is NOT in the existing set; safe to insert. */
  newRows: ReadonlyArray<ImportRow>
  /** Rows whose fingerprint IS in the existing set; show as 'already imported'. */
  duplicateRows: ReadonlyArray<ImportRow>
}

/**
 * Splits incoming rows into new vs duplicate based on the supplied fingerprint set.
 * Pure — no DB calls. Caller fetches existing fingerprints separately.
 *
 * Dedup is applied in two passes against the same fingerprint set:
 *   1. Against the DB's existing fingerprints (`existingFingerprints`).
 *   2. Against the in-batch set built up as we iterate. A CSV exported
 *      with the same charge repeated (American Express occasionally does
 *      this) would otherwise survive step 1 — all rows in the batch are
 *      "new" relative to the DB — but each subsequent occurrence of the
 *      same fingerprint inside this batch is a duplicate.
 *
 * This eliminates the 17 in-batch identical-fingerprint duplicates we
 * cleaned up on the Amex Platinum account in commit XX (see history).
 */
export function dedup(
  incoming: ReadonlyArray<ImportRow>,
  existingFingerprints: ReadonlySet<string>
): DedupResult {
  const newRows: ImportRow[] = []
  const duplicateRows: ImportRow[] = []
  const seenInBatch = new Set<string>()

  for (const row of incoming) {
    if (existingFingerprints.has(row.fingerprint) || seenInBatch.has(row.fingerprint)) {
      duplicateRows.push(row)
    } else {
      seenInBatch.add(row.fingerprint)
      newRows.push(row)
    }
  }

  return { newRows, duplicateRows }
}
