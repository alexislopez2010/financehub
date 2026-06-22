import { describe, expect, it } from 'vitest'
import { resolveTier, isSpendTier, type ResolveTierInput } from './tier'

describe('isSpendTier', () => {
  it('accepts the three valid tiers', () => {
    expect(isSpendTier('essential')).toBe(true)
    expect(isSpendTier('services')).toBe(true)
    expect(isSpendTier('discretionary')).toBe(true)
  })

  it('rejects null, unknown strings, and non-strings', () => {
    expect(isSpendTier(null)).toBe(false)
    expect(isSpendTier('Essential')).toBe(false)  // case-sensitive
    expect(isSpendTier('savings')).toBe(false)
    expect(isSpendTier(42)).toBe(false)
    expect(isSpendTier(undefined)).toBe(false)
  })
})

function input(over: Partial<ResolveTierInput> = {}): ResolveTierInput {
  return {
    billTier: null,
    categoryTier: null,
    isFixed: null,
    hasLinkedDebt: false,
    hasBill: false,
    ...over
  }
}

describe('resolveTier', () => {
  it('returns the explicit bill tier when set (highest precedence)', () => {
    expect(resolveTier(input({ billTier: 'essential', categoryTier: 'discretionary', isFixed: false }))).toBe('essential')
  })

  it('falls back to the category tier when no bill tier', () => {
    expect(resolveTier(input({ categoryTier: 'services', isFixed: true }))).toBe('services')
  })

  it('auto: fixed category is essential even with no bill (e.g. groceries)', () => {
    expect(resolveTier(input({ isFixed: true, hasBill: false }))).toBe('essential')
  })

  it('auto: a debt-linked bill is essential (mortgage, car) even if category is not fixed', () => {
    expect(resolveTier(input({ isFixed: false, hasLinkedDebt: true, hasBill: true }))).toBe('essential')
  })

  it('auto: a non-fixed, non-debt bill is services (subscriptions)', () => {
    expect(resolveTier(input({ isFixed: false, hasLinkedDebt: false, hasBill: true }))).toBe('services')
  })

  it('auto: non-fixed spend with no bill is discretionary (dining, shopping)', () => {
    expect(resolveTier(input({ isFixed: false, hasBill: false }))).toBe('discretionary')
  })

  it('auto: unknown is_fixed (null) with no bill is discretionary', () => {
    expect(resolveTier(input({ isFixed: null, hasBill: false }))).toBe('discretionary')
  })
})
