import { describe, expect, it } from 'vitest'
import {
  computeFingerprint,
  computeFingerprintsBatch,
  normalizeDescriptionForFingerprint
} from './fingerprint'

describe('computeFingerprint', () => {
  it('matches the Python importer output for a known fixture (NETFLIX/Chase Sapphire)', async () => {
    // Arrange — fixture computed via:
    //   echo -n "2026-05-15|netflix|-15.99|chase sapphire" | shasum -a 256 | head -c 16
    const input = {
      date: '2026-05-15',
      description: 'NETFLIX',
      amount: -15.99,
      account: 'Chase Sapphire'
    }
    const expected = '8404cbbfd6d6315d'

    // Act
    const fp = await computeFingerprint(input)

    // Assert
    expect(fp).toBe(expected)
  })

  it('returns 16 hex characters', async () => {
    // Arrange
    const input = { date: '2026-01-01', description: 'X', amount: 0, account: 'A' }

    // Act
    const fp = await computeFingerprint(input)

    // Assert
    expect(fp).toMatch(/^[0-9a-f]{16}$/)
  })

  it('is deterministic for the same input', async () => {
    // Arrange
    const input = { date: '2026-01-01', description: 'STARBUCKS', amount: -4.5, account: 'Amex' }

    // Act
    const a = await computeFingerprint(input)
    const b = await computeFingerprint(input)

    // Assert
    expect(a).toBe(b)
  })

  it('is case-insensitive on description', async () => {
    // Arrange
    const lower = { date: '2026-01-01', description: 'starbucks', amount: -4.5, account: 'Amex' }
    const upper = { date: '2026-01-01', description: 'STARBUCKS', amount: -4.5, account: 'Amex' }

    // Act
    const a = await computeFingerprint(lower)
    const b = await computeFingerprint(upper)

    // Assert
    expect(a).toBe(b)
  })

  it('is case-insensitive on account', async () => {
    // Arrange
    const lower = { date: '2026-01-01', description: 'X', amount: 1, account: 'chase' }
    const upper = { date: '2026-01-01', description: 'X', amount: 1, account: 'CHASE' }

    // Act
    const a = await computeFingerprint(lower)
    const b = await computeFingerprint(upper)

    // Assert
    expect(a).toBe(b)
  })

  it('differs when amount changes', async () => {
    // Arrange
    const a = await computeFingerprint({ date: '2026-01-01', description: 'X', amount: 10, account: 'A' })
    const b = await computeFingerprint({ date: '2026-01-01', description: 'X', amount: 10.01, account: 'A' })

    // Assert
    expect(a).not.toBe(b)
  })

  it('differs when date changes', async () => {
    // Arrange
    const a = await computeFingerprint({ date: '2026-01-01', description: 'X', amount: 1, account: 'A' })
    const b = await computeFingerprint({ date: '2026-01-02', description: 'X', amount: 1, account: 'A' })

    // Assert
    expect(a).not.toBe(b)
  })

  it('matches Python float repr for whole-dollar amounts', async () => {
    // Arrange — Python reads Excel amounts as floats, so f"{-300.0}" → "-300.0".
    // JS's String(-300) gives "-300" (no ".0"), which would silently break dedup
    // against rows the Python importer inserted. The pythonFloatStr helper fixes this.
    // Fixture: echo -n "2026-04-01|chase payment|-300.0|chase sapphire" | shasum -a 256 | head -c 16
    const input = {
      date: '2026-04-01',
      description: 'CHASE PAYMENT',
      amount: -300,
      account: 'Chase Sapphire'
    }
    const expected = '731a59c2f74db220'

    // Act
    const fp = await computeFingerprint(input)

    // Assert
    expect(fp).toBe(expected)
  })

  it('matches Python float repr for zero amount', async () => {
    // Arrange — Python's f"{0.0}" → "0.0", not "0". The Python importer reads
    // Excel amounts as floats and would emit "0.0" for a zero-amount adjustment.
    // Fixture: echo -n "2026-01-01|adjustment|0.0|test" | shasum -a 256 | head -c 16
    const input = {
      date: '2026-01-01',
      description: 'ADJUSTMENT',
      amount: 0,
      account: 'Test'
    }
    const expected = '74d5078063874c56'

    // Act
    const fp = await computeFingerprint(input)

    // Assert
    expect(fp).toBe(expected)
  })
})

describe('computeFingerprintsBatch', () => {
  it('returns one fingerprint per input row in the same order', async () => {
    // Arrange
    const inputs = [
      { date: '2026-01-01', description: 'A', amount: -1, account: 'X' },
      { date: '2026-01-02', description: 'B', amount: -2, account: 'X' },
      { date: '2026-01-03', description: 'C', amount: -3, account: 'X' }
    ]

    // Act
    const fps = await computeFingerprintsBatch(inputs)

    // Assert
    expect(fps).toHaveLength(3)
    for (const fp of fps) {
      expect(fp).toMatch(/^[0-9a-f]{16}$/)
    }
    // Order must match individual computation order.
    const individual = await Promise.all(inputs.map(i => computeFingerprint(i)))
    expect([...fps]).toEqual(individual)
  })

  it('handles empty input', async () => {
    // Arrange / Act
    const fps = await computeFingerprintsBatch([])

    // Assert
    expect(fps).toEqual([])
  })

  it('produces identical hashes for duplicate inputs', async () => {
    // Arrange
    const x = { date: '2026-01-01', description: 'X', amount: 1, account: 'A' }
    const inputs = [x, x, x]

    // Act
    const fps = await computeFingerprintsBatch(inputs)

    // Assert
    expect(fps[0]).toBe(fps[1])
    expect(fps[1]).toBe(fps[2])
  })
})

describe('normalizeDescriptionForFingerprint', () => {
  it('collapses internal whitespace runs', () => {
    expect(normalizeDescriptionForFingerprint('UNITED AIRLINES     HOUSTON             TX'))
      .toBe('UNITED AIRLINES HOUSTON TX')
  })

  it('strips a single trailing parenthetical (Amex extra-detail suffix)', () => {
    const long = 'UNITED AIRLINES HOUSTON TX (ALEXIS LOPEZ-41007-13386046    WWW.UNITED.COM UNITED AIRLINES HOUSTON TX)'
    expect(normalizeDescriptionForFingerprint(long)).toBe('UNITED AIRLINES HOUSTON TX')
  })

  it('keeps a parenthetical that is NOT at the end', () => {
    expect(normalizeDescriptionForFingerprint('PAYPAL (ID 123) THANK YOU'))
      .toBe('PAYPAL (ID 123) THANK YOU')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeDescriptionForFingerprint('   STARBUCKS   ')).toBe('STARBUCKS')
  })

  it('is a no-op for already-clean descriptions', () => {
    expect(normalizeDescriptionForFingerprint('NETFLIX')).toBe('NETFLIX')
    expect(normalizeDescriptionForFingerprint('CHASE PAYMENT')).toBe('CHASE PAYMENT')
  })
})

describe('computeFingerprint — Amex re-export collapse', () => {
  it('collapses Amex short-form + long-form duplicates into the same fingerprint', async () => {
    // Regression: the Amex Platinum CSV re-exported the same charge with
    // extra detail in a trailing parenthetical, producing a different
    // fingerprint and a "ghost duplicate" in the DB. After normalization
    // both shapes must collapse to the same hash so dedup catches it.
    const short = {
      date: '2026-05-12',
      description: 'UNITED AIRLINES     HOUSTON             TX',
      amount: -24,
      account: 'American Express Platinum'
    }
    const long = {
      date: '2026-05-12',
      description: 'UNITED AIRLINES HOUSTON TX (ALEXIS LOPEZ-41007-13386046    WWW.UNITED.COM UNITED AIRLINES HOUSTON TX)',
      amount: -24,
      account: 'American Express Platinum'
    }
    expect(await computeFingerprint(short)).toBe(await computeFingerprint(long))
  })

  it('does NOT collapse genuinely different descriptions on the same day/amount', async () => {
    const a = {
      date: '2026-05-12',
      description: 'STARBUCKS',
      amount: -24,
      account: 'Amex'
    }
    const b = {
      date: '2026-05-12',
      description: 'UNITED AIRLINES',
      amount: -24,
      account: 'Amex'
    }
    expect(await computeFingerprint(a)).not.toBe(await computeFingerprint(b))
  })
})
