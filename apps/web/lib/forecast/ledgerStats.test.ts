import { describe, expect, it } from 'vitest'
import { calendarMonthAverage, trailingMonthlyAverage, type StatTxn } from './ledgerStats'

function tx(over: Partial<StatTxn> = {}): StatTxn {
  return { date: '2025-01-15', amount: -100, type: 'Expense', category: 'Gas', ...over }
}

describe('calendarMonthAverage', () => {
  it('averages |amount| of Expense rows for the category in the given calendar month across years', () => {
    const txns = [
      tx({ date: '2024-01-10', amount: -200, category: 'Gas' }),
      tx({ date: '2025-01-12', amount: -160, category: 'Gas' }),
      tx({ date: '2025-07-12', amount: -40,  category: 'Gas' }),   // wrong month
      tx({ date: '2025-01-20', amount: -300, category: 'Other' }) // wrong category
    ]
    // Two Januaries for Gas: 200 + 160 = 360 across 2 distinct years → 180.
    expect(calendarMonthAverage(txns, 'Gas', 1)).toBe(180)
  })

  it('returns null when there is no history for that category+month', () => {
    expect(calendarMonthAverage([tx({ category: 'Gas' })], 'Water', 1)).toBeNull()
  })

  it('ignores non-Expense rows', () => {
    const txns = [
      tx({ date: '2025-01-10', amount: 500, type: 'Income', category: 'Gas' }),
      tx({ date: '2025-01-11', amount: -120, type: 'Expense', category: 'Gas' })
    ]
    expect(calendarMonthAverage(txns, 'Gas', 1)).toBe(120)
  })
})

describe('trailingMonthlyAverage', () => {
  it('averages total monthly Expense spend for the category over the trailing window', () => {
    const txns = [
      tx({ date: '2026-03-02', amount: -50, category: 'Dining' }),
      tx({ date: '2026-03-20', amount: -70, category: 'Dining' }),  // March total 120
      tx({ date: '2026-04-05', amount: -80, category: 'Dining' })   // April total 80
    ]
    // Two active months (Mar, Apr): (120 + 80) / 2 = 100.
    expect(trailingMonthlyAverage(txns, 'Dining', { year: 2026, month: 5 }, 6)).toBe(100)
  })

  it('returns 0 when there is no spend in the window', () => {
    expect(trailingMonthlyAverage([], 'Dining', { year: 2026, month: 5 }, 6)).toBe(0)
  })
})
