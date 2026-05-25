/**
 * RFC 4180-ish CSV parser. Hand-rolled — no library deps.
 *
 * Handles:
 *   - BOM stripped at start of file
 *   - CRLF and LF line endings (mixed allowed)
 *   - Quoted fields with embedded commas and newlines
 *   - Escaped quotes inside quoted fields: ""
 *   - Empty rows (skipped, NOT flagged as malformed)
 *   - Trailing newline (skipped, not malformed)
 *   - Row column count != headers.length → hasMalformedRows = true (row still
 *     included so the user can see it in preview)
 *
 * Does NOT handle:
 *   - TSV / pipe / semicolon delimiters
 */

export interface ParsedCsv {
  /** Trimmed headers from row 0, original case preserved. */
  readonly headers: ReadonlyArray<string>
  /** Raw string cells. Each row's length may differ from headers.length. */
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
  /** True when at least one data row has column count != headers.length. */
  readonly hasMalformedRows: boolean
}

const BOM = '﻿'

export function parseCsv(text: string): ParsedCsv {
  const cleaned = text.startsWith(BOM) ? text.slice(BOM.length) : text
  const allRows = tokenizeRows(cleaned)

  // Drop fully-empty rows (single empty cell) — these are blank lines.
  const nonEmptyRows = allRows.filter(row => !(row.length === 1 && row[0] === ''))

  if (nonEmptyRows.length === 0) {
    return { headers: [], rows: [], hasMalformedRows: false }
  }

  const headerRow = nonEmptyRows[0] ?? []
  const headers = headerRow.map(h => h.trim())
  const dataRows = nonEmptyRows.slice(1)

  const hasMalformedRows = dataRows.some(row => row.length !== headers.length)

  return { headers, rows: dataRows, hasMalformedRows }
}

/**
 * Tokenizes CSV text into rows of cells.
 * Each row is an array of string cell values.
 */
function tokenizeRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        // Lookahead for escaped quote ("")
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cell += ch
      }
      continue
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true
      continue
    }

    if (ch === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (ch === '\r') {
      // Handle CRLF: skip the \n that follows
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (text[i + 1] === '\n') {
        i++
      }
      continue
    }

    if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += ch
  }

  // Flush the final cell + row if there's anything left.
  // If the file ended with a newline, we already pushed; cell will be ''
  // and row will be []. Skip that case so we don't add a phantom empty row.
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows
}
