import { describe, it, expect } from 'vitest'
import {
  parseFiltersFromUrl, serializeFiltersToUrl, toDataFilters, isEmpty, defaultFilters,
  type LedgerFilters
} from './filters'

describe('parseFiltersFromUrl', () => {
  it('returns empty object when no params present', () => {
    expect(parseFiltersFromUrl(new URLSearchParams())).toEqual({})
  })

  it('parses date range', () => {
    const p = new URLSearchParams('start=2025-01-01&end=2025-12-31')
    expect(parseFiltersFromUrl(p)).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-12-31'
    })
  })

  it('ignores malformed date strings', () => {
    const p = new URLSearchParams('start=2025-01&end=tomorrow')
    expect(parseFiltersFromUrl(p)).toEqual({})
  })

  it('parses categoryId from uuid', () => {
    const p = new URLSearchParams('category=abc-123')
    expect(parseFiltersFromUrl(p).categoryId).toBe('abc-123')
  })

  it('parses "uncategorized" as null categoryId', () => {
    const p = new URLSearchParams('category=uncategorized')
    expect(parseFiltersFromUrl(p).categoryId).toBeNull()
  })

  it('parses each of the four transaction types', () => {
    for (const t of ['Income', 'Expense', 'Transfer', 'Refund'] as const) {
      const p = new URLSearchParams(`type=${t}`)
      expect(parseFiltersFromUrl(p).type).toBe(t)
    }
  })

  it('ignores invalid type values', () => {
    const p = new URLSearchParams('type=garbage')
    expect(parseFiltersFromUrl(p).type).toBeUndefined()
  })

  it('parses free-text q', () => {
    const p = new URLSearchParams('q=anthropic')
    expect(parseFiltersFromUrl(p).q).toBe('anthropic')
  })

  it('parses account and member strings', () => {
    const p = new URLSearchParams('account=Chase+Card&member=Alexis')
    const f = parseFiltersFromUrl(p)
    expect(f.account).toBe('Chase Card')
    expect(f.member).toBe('Alexis')
  })
})

describe('serializeFiltersToUrl', () => {
  it('emits empty params for empty input', () => {
    expect(serializeFiltersToUrl({}).toString()).toBe('')
  })

  it('round-trips a populated filter set', () => {
    const f = {
      startDate: '2025-05-01',
      endDate: '2025-05-31',
      categoryId: 'abc-123',
      account: 'Chase',
      member: 'Alexis',
      type: 'Expense' as const,
      q: 'food'
    }
    const params = serializeFiltersToUrl(f)
    const reparsed = parseFiltersFromUrl(params)
    expect(reparsed).toEqual(f)
  })

  it('encodes null categoryId as "uncategorized"', () => {
    const f = { categoryId: null }
    expect(serializeFiltersToUrl(f).get('category')).toBe('uncategorized')
  })

  it('omits undefined fields', () => {
    const p = serializeFiltersToUrl({ startDate: '2025-05-01' })
    expect(p.has('start')).toBe(true)
    expect(p.has('end')).toBe(false)
    expect(p.has('category')).toBe(false)
  })

  it('does NOT emit undefined categoryId as "uncategorized"', () => {
    // categoryId === undefined should NOT serialize; only null === "uncategorized"
    // Use a cast to test the guard — exactOptionalPropertyTypes means we can't
    // assign undefined directly to an optional string | null field.
    const p = serializeFiltersToUrl({ categoryId: undefined } as unknown as LedgerFilters)
    expect(p.has('category')).toBe(false)
  })
})

describe('toDataFilters', () => {
  it('strips q', () => {
    const f = { startDate: '2025-05-01', q: 'food' }
    expect(toDataFilters(f)).toEqual({ startDate: '2025-05-01' })
  })

  it('preserves null categoryId (does not strip)', () => {
    const f = { categoryId: null }
    expect(toDataFilters(f)).toEqual({ categoryId: null })
  })
})

describe('isEmpty', () => {
  it('true for {}', () => {
    expect(isEmpty({})).toBe(true)
  })
  it('false when any field set', () => {
    expect(isEmpty({ startDate: '2025-05-01' })).toBe(false)
    expect(isEmpty({ categoryId: null })).toBe(false)  // uncategorized is a filter
    expect(isEmpty({ q: 'food' })).toBe(false)
  })
})

describe('defaultFilters', () => {
  it('returns a 90-day window ending today', () => {
    const today = new Date('2025-05-23T00:00:00Z')
    const f = defaultFilters(today)
    expect(f.endDate).toBe('2025-05-23')
    expect(f.startDate).toBe('2025-02-22')
  })
})
