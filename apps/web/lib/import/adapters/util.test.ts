import { describe, it, expect } from 'vitest'
import { parseUsDate, parseMoney } from './util'

describe('parseUsDate', () => {
  describe('slash-separated (Chase / Capital One / Discover / Amex)', () => {
    it('parses MM/DD/YYYY', () => {
      expect(parseUsDate('05/22/2026')).toBe('2026-05-22')
    })

    it('parses M/D/YYYY (single-digit month and day)', () => {
      expect(parseUsDate('5/2/2026')).toBe('2026-05-02')
    })

    it('parses MM/DD/YY (assumes 20YY)', () => {
      expect(parseUsDate('05/22/26')).toBe('2026-05-22')
    })
  })

  describe('dash-separated (Citibank)', () => {
    it('parses MM-DD-YYYY (the format that broke Citibank import)', () => {
      expect(parseUsDate('05-22-2026')).toBe('2026-05-22')
    })

    it('parses M-D-YYYY', () => {
      expect(parseUsDate('5-2-2026')).toBe('2026-05-02')
    })

    it('parses MM-DD-YY', () => {
      expect(parseUsDate('05-22-26')).toBe('2026-05-22')
    })
  })

  describe('invalid inputs', () => {
    it('rejects mixed separators (MM/DD-YYYY)', () => {
      expect(parseUsDate('05/22-2026')).toBeNull()
    })

    it('rejects mixed separators (MM-DD/YYYY)', () => {
      expect(parseUsDate('05-22/2026')).toBeNull()
    })

    it('rejects empty string', () => {
      expect(parseUsDate('')).toBeNull()
    })

    it('rejects month > 12', () => {
      expect(parseUsDate('13/01/2026')).toBeNull()
    })

    it('rejects day > 31', () => {
      expect(parseUsDate('01/32/2026')).toBeNull()
    })

    it('rejects non-numeric', () => {
      expect(parseUsDate('May 22 2026')).toBeNull()
    })

    it('rejects ISO format (YYYY-MM-DD) — not the function\'s job', () => {
      expect(parseUsDate('2026-05-22')).toBeNull()
    })
  })
})

describe('parseMoney', () => {
  // Light sanity tests; the existing adapter tests exercise this thoroughly
  it('parses plain decimal', () => {
    expect(parseMoney('42.50')).toBe(42.5)
  })

  it('parses with dollar sign + commas', () => {
    expect(parseMoney('$1,234.56')).toBe(1234.56)
  })

  it('treats parens as negative (accounting notation)', () => {
    expect(parseMoney('(42.50)')).toBe(-42.5)
  })

  it('returns null for empty', () => {
    expect(parseMoney('')).toBeNull()
  })

  it('returns null for non-numeric', () => {
    expect(parseMoney('abc')).toBeNull()
  })
})
