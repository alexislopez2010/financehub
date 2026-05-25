/**
 * Shared types for per-bank CSV adapters.
 *
 * Adapters convert raw CSV cells into normalized ImportRow shape.
 * They do NOT compute fingerprint or categoryId — those are separate passes.
 */

export type TransactionType = 'Income' | 'Expense' | 'Transfer' | 'Refund'

export interface ImportRow {
  /** ISO yyyy-mm-dd. */
  date: string
  description: string
  /** Signed: positive = inflow (income/refund), negative = expense. */
  amount: number
  type: TransactionType
  /** Set later by categorize.ts; nullable until then. */
  categoryId: string | null
  /** Set later by categorize.ts; nullable until then. */
  billId: string | null
  /** Computed by fingerprint.ts. */
  fingerprint: string
  /** Adapter name that produced this row (for error reporting). */
  source: string
}

/** What an adapter returns before fingerprint + categorize passes run. */
export type ParsedImportRow = Omit<ImportRow, 'fingerprint' | 'categoryId' | 'billId'>

export interface SkippedRow {
  rowIndex: number
  reason: string
}

export interface AdapterParseResult {
  parsed: ReadonlyArray<ParsedImportRow>
  skipped: ReadonlyArray<SkippedRow>
}

export interface Adapter {
  /** Human-readable name for the UI banner. */
  readonly name: string
  /** Returns true if this adapter can parse the given headers. Strict. */
  matches(headers: ReadonlyArray<string>): boolean
  /**
   * Convert raw CSV rows into ImportRow[]. Caller passes headers + data rows
   * separately (matches ParsedCsv.{headers, rows}).
   *
   * Skips rows that can't be parsed (returns them in skipped[] with a reason).
   * Does NOT compute fingerprint or categoryId — those happen in later passes.
   */
  parse(
    headers: ReadonlyArray<string>,
    rows: ReadonlyArray<ReadonlyArray<string>>
  ): AdapterParseResult
}
