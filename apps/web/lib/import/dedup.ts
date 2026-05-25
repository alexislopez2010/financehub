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
 */
export function dedup(
  incoming: ReadonlyArray<ImportRow>,
  existingFingerprints: ReadonlySet<string>
): DedupResult {
  const newRows: ImportRow[] = []
  const duplicateRows: ImportRow[] = []

  for (const row of incoming) {
    if (existingFingerprints.has(row.fingerprint)) {
      duplicateRows.push(row)
    } else {
      newRows.push(row)
    }
  }

  return { newRows, duplicateRows }
}
