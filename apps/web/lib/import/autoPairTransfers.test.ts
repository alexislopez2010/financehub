import { describe, expect, it } from 'vitest'
import { planAutoPairs, type PairableImportedRow, type PairCandidate } from './autoPairTransfers'

function imp(over: Partial<PairableImportedRow> = {}): PairableImportedRow {
  return {
    id: 'imp1',
    date: '2026-05-16',
    amount: 6000,
    pairAccountFilter: 'Citibank',
    ...over
  }
}

function cand(over: Partial<PairCandidate> = {}): PairCandidate {
  return {
    id: 'c1',
    date: '2026-05-16',
    amount: -6000,
    account_id: 'acct-citibank',
    created_at: '2026-05-17T12:00:00Z',
    ...over
  }
}

describe('planAutoPairs', () => {
  it('returns empty when no candidates match', () => {
    // Arrange
    const plan = planAutoPairs({ importedRows: [imp()], candidates: [] })

    // Assert
    expect(plan).toEqual([])
  })

  it('pairs an imported row with a same-date opposite-sign candidate', () => {
    // Arrange
    const plan = planAutoPairs({
      importedRows: [imp({ id: 'i1', date: '2026-05-16', amount: 6000 })],
      candidates: [cand({ id: 'c1', date: '2026-05-16', amount: -6000 })]
    })

    // Assert
    expect(plan).toEqual([{ importedRowId: 'i1', partnerRowId: 'c1' }])
  })

  it('skips candidates with mismatched date', () => {
    // Arrange
    const plan = planAutoPairs({
      importedRows: [imp({ id: 'i1', date: '2026-05-16' })],
      candidates: [cand({ id: 'c1', date: '2026-05-15', amount: -6000 })]
    })

    // Assert
    expect(plan).toEqual([])
  })

  it('skips candidates with mismatched amount magnitude', () => {
    // Arrange
    const plan = planAutoPairs({
      importedRows: [imp({ id: 'i1', amount: 6000 })],
      candidates: [cand({ id: 'c1', amount: -5999.99 })]
    })

    // Assert
    expect(plan).toEqual([])
  })

  it('skips same-sign candidates (both inflows or both outflows)', () => {
    // Arrange — a $6000 payment in AmEx is positive; the partner must be negative.
    const plan = planAutoPairs({
      importedRows: [imp({ id: 'i1', amount: 6000 })],
      candidates: [cand({ id: 'c1', amount: 6000 })]
    })

    // Assert
    expect(plan).toEqual([])
  })

  it('each candidate can be consumed only once', () => {
    // Arrange — two imported rows compete for one candidate.
    const plan = planAutoPairs({
      importedRows: [
        imp({ id: 'i1', date: '2026-05-16', amount: 6000 }),
        imp({ id: 'i2', date: '2026-05-16', amount: 6000 })
      ],
      candidates: [
        cand({ id: 'c1', date: '2026-05-16', amount: -6000 })
      ]
    })

    // Assert — first imported row wins, second has no candidate.
    expect(plan).toEqual([{ importedRowId: 'i1', partnerRowId: 'c1' }])
  })

  it('picks the earliest-created candidate when multiple match', () => {
    // Arrange — earlier candidate is preferred for idempotent re-runs.
    const plan = planAutoPairs({
      importedRows: [imp({ id: 'i1', amount: 6000 })],
      candidates: [
        cand({ id: 'c-new', amount: -6000, created_at: '2026-05-20T10:00:00Z' }),
        cand({ id: 'c-old', amount: -6000, created_at: '2026-05-17T12:00:00Z' })
      ]
    })

    // Assert
    expect(plan).toEqual([{ importedRowId: 'i1', partnerRowId: 'c-old' }])
  })

  it('handles created_at = null gracefully (uses id as tiebreak)', () => {
    // Arrange
    const plan = planAutoPairs({
      importedRows: [imp({ id: 'i1', amount: 6000 })],
      candidates: [
        cand({ id: 'c-z', amount: -6000, created_at: null }),
        cand({ id: 'c-a', amount: -6000, created_at: null })
      ]
    })

    // Assert — alphabetical id wins on tie.
    expect(plan).toEqual([{ importedRowId: 'i1', partnerRowId: 'c-a' }])
  })

  it('pairs each imported row with its own distinct counterparty', () => {
    // Arrange — two distinct pairs on the same day.
    const plan = planAutoPairs({
      importedRows: [
        imp({ id: 'i1', date: '2026-01-31', amount: 56.50  }),
        imp({ id: 'i2', date: '2026-01-31', amount: 379.07 })
      ],
      candidates: [
        cand({ id: 'c1', date: '2026-01-31', amount: -56.50  }),
        cand({ id: 'c2', date: '2026-01-31', amount: -379.07 })
      ]
    })

    // Assert
    expect(plan).toHaveLength(2)
    expect(plan).toContainEqual({ importedRowId: 'i1', partnerRowId: 'c1' })
    expect(plan).toContainEqual({ importedRowId: 'i2', partnerRowId: 'c2' })
  })

  it('preserves imported-row input order in the output plan', () => {
    // Arrange
    const plan = planAutoPairs({
      importedRows: [
        imp({ id: 'i-late',  date: '2026-05-16', amount: 100 }),
        imp({ id: 'i-early', date: '2026-04-30', amount: 200 })
      ],
      candidates: [
        cand({ id: 'c-late',  date: '2026-05-16', amount: -100 }),
        cand({ id: 'c-early', date: '2026-04-30', amount: -200 })
      ]
    })

    // Assert
    expect(plan.map(p => p.importedRowId)).toEqual(['i-late', 'i-early'])
  })
})
