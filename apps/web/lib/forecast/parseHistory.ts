/**
 * Deterministic parser that turns pasted bill history into structured
 * {year, month, amount} observations — the offline replacement for the AI
 * extraction step. It reads the common shapes real billing history comes in
 * (statement tables, month/amount lists, CSV-ish rows) with regex + heuristics:
 * no model, no key, fully auditable.
 *
 * Pure: the caller injects `defaultYear` (used only when a line names a month
 * with no year). The output feeds distillSeasonalProfile, which still does all
 * the counting — "code reads AND counts".
 */

import type { HistoryObservation } from './distillHistory'

export interface ParseHistoryOptions {
  /** Year assumed when a line names a month but no year (e.g. "January: $180"). */
  defaultYear: number
}

export interface ParseHistoryResult {
  observations: HistoryObservation[]
  /** Non-empty lines that yielded no (month, amount) pair. */
  skipped: number
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12
}

// Longest names first so "january" wins over "jan" in the alternation.
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

function fourDigitYear(y: number): number {
  return y < 100 ? 2000 + y : y
}

interface DateHit {
  year: number
  month: number
  start: number
  end: number
}

/** Finds the first recognizable date token in a line, most specific first. */
function extractDate(line: string, defaultYear: number): DateHit | null {
  const lower = line.toLowerCase()

  const patterns: ReadonlyArray<{ re: RegExp; pick: (m: RegExpExecArray) => { year: number; month: number } }> = [
    // ISO full date: 2024-01-15 (day ignored)
    { re: /(\d{4})-(\d{1,2})-(\d{1,2})/, pick: m => ({ year: +m[1]!, month: +m[2]! }) },
    // US full date: 1/15/2024 -> month, year (day ignored)
    { re: /(\d{1,2})\/(\d{1,2})\/(\d{4})/, pick: m => ({ year: +m[3]!, month: +m[1]! }) },
    // Year-month: 2024-01 or 2024/01
    { re: /(\d{4})[-/](\d{1,2})/, pick: m => ({ year: +m[1]!, month: +m[2]! }) },
    // Month-year: 01/2024 or 01-2024
    { re: /(\d{1,2})[-/](\d{4})/, pick: m => ({ year: +m[2]!, month: +m[1]! }) },
    // Month name + year: "Jan 2024", "January, 2024", "Jan '24"
    { re: new RegExp(`\\b(${MONTH_NAMES})\\.?,?\\s+'?(\\d{2,4})\\b`), pick: m => ({ year: fourDigitYear(+m[2]!), month: MONTHS[m[1]!]! }) },
    // Year + month name: "2024 January"
    { re: new RegExp(`\\b(\\d{4})\\s+(${MONTH_NAMES})\\b`), pick: m => ({ year: +m[1]!, month: MONTHS[m[2]!]! }) },
    // Month name alone: "January: $180" -> default year
    { re: new RegExp(`\\b(${MONTH_NAMES})\\b`), pick: m => ({ year: defaultYear, month: MONTHS[m[1]!]! }) }
  ]

  for (const { re, pick } of patterns) {
    const m = re.exec(lower)
    if (!m) continue
    const { year, month } = pick(m)
    if (month < 1 || month > 12) continue
    return { year, month, start: m.index, end: m.index + m[0].length }
  }
  return null
}

/** Parses one currency-ish token (handles $, commas, parens/leading-minus). */
function toAmount(raw: string): number | null {
  const negative = /^\(.*\)$/.test(raw.trim()) || /-/.test(raw)
  const digits = raw.replace(/[^0-9.]/g, '')
  if (digits === '' || digits === '.') return null
  const n = Number.parseFloat(digits)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

/** Picks the most amount-like number from a string (date already removed). */
function extractAmount(s: string): number | null {
  const tokens = s.match(/\(?-?\$?\s?-?\d[\d,]*(?:\.\d+)?\)?/g)
  if (!tokens) return null
  // Prefer a token that looks monetary ($ or a decimal); else take the last number.
  const monetary = tokens.find(t => t.includes('$') || t.includes('.'))
  return toAmount(monetary ?? tokens[tokens.length - 1]!)
}

export function parseHistory(text: string, opts: ParseHistoryOptions): ParseHistoryResult {
  const observations: HistoryObservation[] = []
  let skipped = 0

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue

    const date = extractDate(line, opts.defaultYear)
    if (!date) { skipped += 1; continue }

    // Remove the matched date span so its digits can't be read as the amount.
    const withoutDate = line.slice(0, date.start) + ' ' + line.slice(date.end)
    const amount = extractAmount(withoutDate)
    if (amount === null) { skipped += 1; continue }

    observations.push({ year: date.year, month: date.month, amount })
  }

  return { observations, skipped }
}
