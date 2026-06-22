import { describe, expect, it } from 'vitest'
import { parseHistory } from './parseHistory'

const OPTS = { defaultYear: 2026 }

describe('parseHistory', () => {
  it('parses a "Mon YYYY  $amount" table', () => {
    const text = [
      'Jan 2024  $182.34',
      'Feb 2024  $171.05',
      'Mar 2024  $140.10'
    ].join('\n')
    const { observations, skipped } = parseHistory(text, OPTS)
    expect(skipped).toBe(0)
    expect(observations).toEqual([
      { year: 2024, month: 1, amount: 182.34 },
      { year: 2024, month: 2, amount: 171.05 },
      { year: 2024, month: 3, amount: 140.1 }
    ])
  })

  it('parses full month names with a colon and no dollar sign', () => {
    const { observations } = parseHistory('January 2025: 180\nFebruary 2025: 165', OPTS)
    expect(observations).toEqual([
      { year: 2025, month: 1, amount: 180 },
      { year: 2025, month: 2, amount: 165 }
    ])
  })

  it('parses ISO year-month rows', () => {
    const { observations } = parseHistory('2024-01  182.34\n2024-02 171.05', OPTS)
    expect(observations).toEqual([
      { year: 2024, month: 1, amount: 182.34 },
      { year: 2024, month: 2, amount: 171.05 }
    ])
  })

  it('parses CSV rows with a full ISO date and ignores the day', () => {
    const { observations } = parseHistory('2024-01-15,Gas,182.34\n2024-02-15,Gas,171.05', OPTS)
    expect(observations).toEqual([
      { year: 2024, month: 1, amount: 182.34 },
      { year: 2024, month: 2, amount: 171.05 }
    ])
  })

  it('parses US M/D/YYYY dates, taking the month and year', () => {
    const { observations } = parseHistory('1/15/2024  $182.34', OPTS)
    expect(observations).toEqual([{ year: 2024, month: 1, amount: 182.34 }])
  })

  it('parses MM/YYYY month-year tokens', () => {
    const { observations } = parseHistory('01/2024 $182.34\n02/2024 $171.05', OPTS)
    expect(observations).toEqual([
      { year: 2024, month: 1, amount: 182.34 },
      { year: 2024, month: 2, amount: 171.05 }
    ])
  })

  it('strips thousands separators from amounts', () => {
    const { observations } = parseHistory('Dec 2024  $1,234.56', OPTS)
    expect(observations).toEqual([{ year: 2024, month: 12, amount: 1234.56 }])
  })

  it('reads parenthesized or negative amounts as negative', () => {
    const { observations } = parseHistory('Jul 2024 (45.00)\nAug 2024 -40.00', OPTS)
    expect(observations).toEqual([
      { year: 2024, month: 7, amount: -45 },
      { year: 2024, month: 8, amount: -40 }
    ])
  })

  it('falls back to the default year when only a month name is given', () => {
    const { observations } = parseHistory('January: $180', OPTS)
    expect(observations).toEqual([{ year: 2026, month: 1, amount: 180 }])
  })

  it('handles two-digit years on month names', () => {
    const { observations } = parseHistory("Jan '24  182.34", OPTS)
    expect(observations).toEqual([{ year: 2024, month: 1, amount: 182.34 }])
  })

  it('parses tab-separated values', () => {
    const { observations } = parseHistory('Feb 2024\t171.05', OPTS)
    expect(observations).toEqual([{ year: 2024, month: 2, amount: 171.05 }])
  })

  it('skips lines with no recognizable month/amount and counts them', () => {
    const text = [
      'Billing history for account 12345',   // no month+amount -> skipped
      'Jan 2024  $182.34',
      '',                                     // blank -> not counted
      'Total: garbage line'                   // no date -> skipped
    ].join('\n')
    const { observations, skipped } = parseHistory(text, OPTS)
    expect(observations).toEqual([{ year: 2024, month: 1, amount: 182.34 }])
    expect(skipped).toBe(2)
  })

  it('returns nothing for empty input', () => {
    expect(parseHistory('   \n  ', OPTS)).toEqual({ observations: [], skipped: 0 })
  })
})
