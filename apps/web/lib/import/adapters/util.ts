/**
 * Shared parsing utilities for adapters.
 *
 * - parseUsDate: handles MM/DD/YYYY, M/D/YYYY, MM/DD/YY, MM-DD-YYYY (assumes 20YY for 2-digit year).
 *   Separator can be '/' (Chase, Capital One, etc.) or '-' (Citibank). The two
 *   separators in a single date must match (rejects MM/DD-YYYY etc.).
 * - parseMoney: strips $, commas, whitespace, parens; returns null if invalid
 * - findHeaderIndex: case-insensitive index lookup
 * - hasHeader: case-insensitive contains check
 */

export function parseUsDate(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  // Capture the separator with \2 backref so both separators must match.
  const m = s.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{2}|\d{4})$/)
  if (!m) return null
  const monthStr = m[1] ?? ''
  const dayStr = m[3] ?? ''
  const yearStr = m[4] ?? ''
  const month = Number(monthStr)
  const day = Number(dayStr)
  let year = Number(yearStr)
  if (yearStr.length === 2) year = 2000 + year
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const mm = String(month).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function parseMoney(raw: string | undefined): number | null {
  if (raw == null) return null
  let s = raw.trim()
  if (!s) return null
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  // Strip $, commas, whitespace
  s = s.replace(/[$,\s]/g, '')
  if (!s) return null
  if (s.startsWith('-')) {
    negative = !negative
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?\d*$/.test(s)) return null
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

export function findHeaderIndex(
  headers: ReadonlyArray<string>,
  candidates: ReadonlyArray<string>
): number {
  const lowered = headers.map(h => h.trim().toLowerCase())
  for (const c of candidates) {
    const idx = lowered.indexOf(c.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}

export function hasHeader(headers: ReadonlyArray<string>, name: string): boolean {
  const target = name.trim().toLowerCase()
  return headers.some(h => h.trim().toLowerCase() === target)
}

export function hasAnyHeader(
  headers: ReadonlyArray<string>,
  names: ReadonlyArray<string>
): boolean {
  return names.some(n => hasHeader(headers, n))
}

export function getCell(row: ReadonlyArray<string>, idx: number): string {
  if (idx < 0 || idx >= row.length) return ''
  return row[idx] ?? ''
}
