import { describe, expect, it } from 'vitest'
import { dedup } from './dedup'
import type { ImportRow } from './adapters/types'

function row(over: Partial<ImportRow> = {}): ImportRow {
  return {
    date: '2026-01-01',
    description: 'X',
    amount: -10,
    type: 'Expense',
    categoryId: null,
    billId: null,
    fingerprint: 'aaaaaaaaaaaaaaaa',
    source: 'Chase',
    ...over
  }
}

describe('dedup', () => {
  it('returns empty result for empty input', () => {
    // Arrange / Act
    const result = dedup([], new Set())

    // Assert
    expect(result.newRows).toEqual([])
    expect(result.duplicateRows).toEqual([])
  })

  it('marks all rows as new when existing set is empty', () => {
    // Arrange
    const rows = [row({ fingerprint: '1111111111111111' }), row({ fingerprint: '2222222222222222' })]

    // Act
    const result = dedup(rows, new Set())

    // Assert
    expect(result.newRows).toHaveLength(2)
    expect(result.duplicateRows).toHaveLength(0)
  })

  it('marks all rows as duplicates when all fingerprints exist', () => {
    // Arrange
    const rows = [row({ fingerprint: '1111111111111111' }), row({ fingerprint: '2222222222222222' })]
    const existing = new Set(['1111111111111111', '2222222222222222'])

    // Act
    const result = dedup(rows, existing)

    // Assert
    expect(result.newRows).toHaveLength(0)
    expect(result.duplicateRows).toHaveLength(2)
  })

  it('correctly splits mixed inputs', () => {
    // Arrange
    const rows = [
      row({ fingerprint: 'aaaa', description: 'new' }),
      row({ fingerprint: 'bbbb', description: 'dupe' }),
      row({ fingerprint: 'cccc', description: 'new' }),
      row({ fingerprint: 'bbbb', description: 'dupe-again' })
    ]
    const existing = new Set(['bbbb'])

    // Act
    const result = dedup(rows, existing)

    // Assert
    expect(result.newRows.map(r => r.fingerprint)).toEqual(['aaaa', 'cccc'])
    expect(result.duplicateRows.map(r => r.fingerprint)).toEqual(['bbbb', 'bbbb'])
  })

  it('preserves input order within each bucket', () => {
    // Arrange
    const rows = [
      row({ fingerprint: '1', description: 'first' }),
      row({ fingerprint: '2', description: 'second' }),
      row({ fingerprint: '3', description: 'third' })
    ]
    const existing = new Set(['2'])

    // Act
    const result = dedup(rows, existing)

    // Assert
    expect(result.newRows.map(r => r.description)).toEqual(['first', 'third'])
    expect(result.duplicateRows.map(r => r.description)).toEqual(['second'])
  })
})
