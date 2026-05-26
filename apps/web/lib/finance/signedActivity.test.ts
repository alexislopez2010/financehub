import { describe, it, expect } from 'vitest'
import { signedActivity, activityDirection } from './signedActivity'

describe('signedActivity', () => {
  it('Expense + positive amount → negative signed', () => {
    expect(signedActivity({ amount: 9.99, type: 'Expense' })).toBe(-9.99)
  })

  it('Expense + negative amount → negative signed', () => {
    expect(signedActivity({ amount: -9.99, type: 'Expense' })).toBe(-9.99)
  })

  it('Income + positive amount → positive signed', () => {
    expect(signedActivity({ amount: 100, type: 'Income' })).toBe(100)
  })

  it('Income + negative amount → positive signed', () => {
    expect(signedActivity({ amount: -100, type: 'Income' })).toBe(100)
  })

  it('Refund + positive amount → positive signed', () => {
    expect(signedActivity({ amount: 25, type: 'Refund' })).toBe(25)
  })

  it('Refund + negative amount → positive signed', () => {
    expect(signedActivity({ amount: -25, type: 'Refund' })).toBe(25)
  })

  it('Transfer + positive amount → positive signed (raw)', () => {
    expect(signedActivity({ amount: 500, type: 'Transfer' })).toBe(500)
  })

  it('Transfer + negative amount → negative signed (raw)', () => {
    expect(signedActivity({ amount: -500, type: 'Transfer' })).toBe(-500)
  })

  it('Expense + zero amount → 0', () => {
    expect(signedActivity({ amount: 0, type: 'Expense' })).toBe(-0)
  })
})

describe('activityDirection', () => {
  it('Income → in', () => {
    expect(activityDirection({ amount: 100, type: 'Income' })).toBe('in')
  })

  it('Refund → in', () => {
    expect(activityDirection({ amount: 25, type: 'Refund' })).toBe('in')
  })

  it('Expense (positive amount) → out', () => {
    expect(activityDirection({ amount: 9.99, type: 'Expense' })).toBe('out')
  })

  it('Expense (negative amount) → out', () => {
    expect(activityDirection({ amount: -9.99, type: 'Expense' })).toBe('out')
  })

  it('Transfer → transfer (regardless of sign)', () => {
    expect(activityDirection({ amount: 500, type: 'Transfer' })).toBe('transfer')
    expect(activityDirection({ amount: -500, type: 'Transfer' })).toBe('transfer')
  })

  it('Income with negative amount still → in (sign normalized via type)', () => {
    expect(activityDirection({ amount: -100, type: 'Income' })).toBe('in')
  })
})
