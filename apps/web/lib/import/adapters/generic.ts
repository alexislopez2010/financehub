import type { Adapter, AdapterParseResult, ParsedImportRow, SkippedRow, TransactionType } from './types'
import { findHeaderIndex, getCell, hasAnyHeader, parseMoney, parseUsDate } from './util'

const NAME = 'Generic CSV'

const DATE_CANDIDATES = ['Transaction Date', 'Posted Date', 'Post Date', 'Date'] as const
const DESC_CANDIDATES = ['Description', 'Payee', 'Memo', 'Details'] as const
const AMOUNT_CANDIDATES = ['Amount', 'Value'] as const

function deriveType(amount: number): TransactionType {
  if (amount < 0) return 'Expense'
  if (amount > 0) return 'Income'
  return 'Expense'
}

export const generic: Adapter = {
  name: NAME,
  matches(headers) {
    return (
      hasAnyHeader(headers, DATE_CANDIDATES as unknown as ReadonlyArray<string>) &&
      hasAnyHeader(headers, DESC_CANDIDATES as unknown as ReadonlyArray<string>) &&
      hasAnyHeader(headers, AMOUNT_CANDIDATES as unknown as ReadonlyArray<string>)
    )
  },
  parse(headers, rows): AdapterParseResult {
    const idxDate = findHeaderIndex(headers, DATE_CANDIDATES as unknown as ReadonlyArray<string>)
    const idxDesc = findHeaderIndex(headers, DESC_CANDIDATES as unknown as ReadonlyArray<string>)
    const idxAmount = findHeaderIndex(headers, AMOUNT_CANDIDATES as unknown as ReadonlyArray<string>)

    const parsed: ParsedImportRow[] = []
    const skipped: SkippedRow[] = []

    rows.forEach((row, i) => {
      const dateRaw = getCell(row, idxDate)
      const descRaw = getCell(row, idxDesc).trim()
      const amountRaw = getCell(row, idxAmount)

      const date = parseUsDate(dateRaw)
      if (!date) {
        skipped.push({ rowIndex: i, reason: `Invalid date: "${dateRaw}"` })
        return
      }
      if (!descRaw) {
        skipped.push({ rowIndex: i, reason: 'Missing description' })
        return
      }
      const amount = parseMoney(amountRaw)
      if (amount == null) {
        skipped.push({ rowIndex: i, reason: `Invalid amount: "${amountRaw}"` })
        return
      }
      // Generic convention (matches Chase): negative = expense.
      parsed.push({
        date,
        description: descRaw,
        amount,
        type: deriveType(amount),
        source: NAME
      })
    })

    return { parsed, skipped }
  }
}
