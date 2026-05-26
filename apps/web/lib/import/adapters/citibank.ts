import type { Adapter, AdapterParseResult, ParsedImportRow, SkippedRow, TransactionType } from './types'
import { findHeaderIndex, getCell, hasHeader, parseMoney, parseUsDate } from './util'

const NAME = 'Citibank'

function deriveType(amount: number): TransactionType {
  if (amount < 0) return 'Expense'
  if (amount > 0) return 'Income'
  return 'Expense'
}

export const citibank: Adapter = {
  name: NAME,
  matches(headers) {
    return (
      hasHeader(headers, 'Status') &&
      hasHeader(headers, 'Date') &&
      hasHeader(headers, 'Description') &&
      hasHeader(headers, 'Debit') &&
      hasHeader(headers, 'Credit')
    )
  },
  parse(headers, rows): AdapterParseResult {
    const idxStatus = findHeaderIndex(headers, ['Status'])
    const idxDate = findHeaderIndex(headers, ['Date'])
    const idxDesc = findHeaderIndex(headers, ['Description'])
    const idxDebit = findHeaderIndex(headers, ['Debit'])
    const idxCredit = findHeaderIndex(headers, ['Credit'])

    const parsed: ParsedImportRow[] = []
    const skipped: SkippedRow[] = []

    rows.forEach((row, i) => {
      const status = getCell(row, idxStatus).trim().toLowerCase()
      // Skip Pending rows — they can be reversed by the bank, so importing
      // creates risk of stale data. Cleared/Posted/empty rows are fine.
      if (status === 'pending') {
        skipped.push({ rowIndex: i, reason: 'Pending status — not yet posted' })
        return
      }

      const dateRaw = getCell(row, idxDate)
      const date = parseUsDate(dateRaw)
      if (!date) {
        skipped.push({ rowIndex: i, reason: `Invalid date: "${dateRaw}"` })
        return
      }

      const descRaw = getCell(row, idxDesc).trim()
      if (!descRaw) {
        skipped.push({ rowIndex: i, reason: 'Missing description' })
        return
      }

      const debitRaw = getCell(row, idxDebit)
      const creditRaw = getCell(row, idxCredit)
      const debitParsed = debitRaw.trim() ? parseMoney(debitRaw) : 0
      const creditParsed = creditRaw.trim() ? parseMoney(creditRaw) : 0
      if (debitParsed == null || creditParsed == null) {
        skipped.push({ rowIndex: i, reason: `Invalid amount: debit="${debitRaw}" credit="${creditRaw}"` })
        return
      }
      // Citibank convention (same as Capital One): one of Debit/Credit is
      // populated per row, both are non-negative magnitudes. Math.abs defends
      // against Excel re-saves picking up accounting paren notation
      // (e.g. "(42.50)") which parseMoney decodes as -42.50.
      const debit = Math.abs(debitParsed)
      const credit = Math.abs(creditParsed)
      if (debit === 0 && credit === 0) {
        skipped.push({ rowIndex: i, reason: 'Both debit and credit are empty' })
        return
      }

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
