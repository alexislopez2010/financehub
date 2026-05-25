import type { Adapter, AdapterParseResult, ParsedImportRow, SkippedRow, TransactionType } from './types'
import { findHeaderIndex, getCell, hasHeader, parseMoney, parseUsDate } from './util'

const NAME = 'Discover'

function deriveType(amount: number): TransactionType {
  if (amount < 0) return 'Expense'
  if (amount > 0) return 'Refund'
  return 'Expense'
}

export const discover: Adapter = {
  name: NAME,
  matches(headers) {
    return (
      hasHeader(headers, 'Trans. Date') &&
      hasHeader(headers, 'Post Date') &&
      hasHeader(headers, 'Amount')
    )
  },
  parse(headers, rows): AdapterParseResult {
    const idxDate = findHeaderIndex(headers, ['Trans. Date'])
    const idxDesc = findHeaderIndex(headers, ['Description'])
    const idxAmount = findHeaderIndex(headers, ['Amount'])

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
      const raw = parseMoney(amountRaw)
      if (raw == null) {
        skipped.push({ rowIndex: i, reason: `Invalid amount: "${amountRaw}"` })
        return
      }
      // Discover convention: positive = expense; flip sign for our convention.
      const amount = -raw

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
