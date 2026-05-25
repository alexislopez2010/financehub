import type { Adapter, AdapterParseResult, ParsedImportRow, SkippedRow, TransactionType } from './types'
import { findHeaderIndex, getCell, hasHeader, parseMoney, parseUsDate } from './util'

const NAME = 'Chase'

function deriveType(typeCell: string, amount: number): TransactionType {
  const t = typeCell.trim().toLowerCase()
  if (t === 'sale') return 'Expense'
  if (t === 'payment' || t === 'return') return 'Refund'
  if (amount < 0) return 'Expense'
  if (amount > 0) return 'Income'
  return 'Expense'
}

export const chase: Adapter = {
  name: NAME,
  matches(headers) {
    return (
      hasHeader(headers, 'Transaction Date') &&
      hasHeader(headers, 'Post Date') &&
      hasHeader(headers, 'Memo')
    )
  },
  parse(headers, rows): AdapterParseResult {
    const idxDate = findHeaderIndex(headers, ['Transaction Date'])
    const idxDesc = findHeaderIndex(headers, ['Description'])
    const idxAmount = findHeaderIndex(headers, ['Amount'])
    const idxType = findHeaderIndex(headers, ['Type'])

    const parsed: ParsedImportRow[] = []
    const skipped: SkippedRow[] = []

    rows.forEach((row, i) => {
      const dateRaw = getCell(row, idxDate)
      const descRaw = getCell(row, idxDesc).trim()
      const amountRaw = getCell(row, idxAmount)
      const typeRaw = getCell(row, idxType)

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

      parsed.push({
        date,
        description: descRaw,
        amount,
        type: deriveType(typeRaw, amount),
        source: NAME
      })
    })

    return { parsed, skipped }
  }
}
