import type { Adapter, AdapterParseResult, ParsedImportRow, SkippedRow, TransactionType } from './types'
import { findHeaderIndex, getCell, hasHeader, parseMoney, parseUsDate } from './util'

const NAME = 'Capital One'

function deriveType(amount: number): TransactionType {
  if (amount < 0) return 'Expense'
  if (amount > 0) return 'Income'
  return 'Expense'
}

export const capitalOne: Adapter = {
  name: NAME,
  matches(headers) {
    return (
      hasHeader(headers, 'Transaction Date') &&
      hasHeader(headers, 'Posted Date') &&
      (hasHeader(headers, 'Debit') || hasHeader(headers, 'Credit'))
    )
  },
  parse(headers, rows): AdapterParseResult {
    const idxDate = findHeaderIndex(headers, ['Transaction Date'])
    const idxDesc = findHeaderIndex(headers, ['Description'])
    const idxDebit = findHeaderIndex(headers, ['Debit'])
    const idxCredit = findHeaderIndex(headers, ['Credit'])

    const parsed: ParsedImportRow[] = []
    const skipped: SkippedRow[] = []

    rows.forEach((row, i) => {
      const dateRaw = getCell(row, idxDate)
      const descRaw = getCell(row, idxDesc).trim()
      const debitRaw = getCell(row, idxDebit)
      const creditRaw = getCell(row, idxCredit)

      const date = parseUsDate(dateRaw)
      if (!date) {
        skipped.push({ rowIndex: i, reason: `Invalid date: "${dateRaw}"` })
        return
      }
      if (!descRaw) {
        skipped.push({ rowIndex: i, reason: 'Missing description' })
        return
      }

      const debit = debitRaw.trim() ? parseMoney(debitRaw) : 0
      const credit = creditRaw.trim() ? parseMoney(creditRaw) : 0
      if (debit == null || credit == null) {
        skipped.push({ rowIndex: i, reason: `Invalid amount: debit="${debitRaw}" credit="${creditRaw}"` })
        return
      }
      if (debit === 0 && credit === 0) {
        skipped.push({ rowIndex: i, reason: 'Both debit and credit are empty' })
        return
      }

      // Capital One convention: charges populate Debit (positive), payments populate Credit (positive).
      // Net amount: credit - debit. Negative = expense.
      const amount = credit - debit

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
