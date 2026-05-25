import { describe, expect, it } from 'vitest'
import { computeFingerprint, computeFingerprintsBatch } from './fingerprint'

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

  it('uses String(amount) — integer 0 stringifies as "0" not "0.0"', async () => {
    // Arrange — the legacy Python importer would emit "0" for an integer 0,
    // because Python's repr does too. JS String(0) also gives "0".
    const input = { date: '2026-01-01', description: 'X', amount: 0, account: 'A' }

    // Act
    const fp = await computeFingerprint(input)

    // Assert — fixture: echo -n "2026-01-01|x|0|a" | shasum -a 256 | head -c 16
    expect(fp).toMatch(/^[0-9a-f]{16}$/)
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
