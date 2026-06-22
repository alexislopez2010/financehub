import { describe, it, expect } from 'vitest'
import { comingDueWithin } from './comingDue'
import type { BillRow } from './comingDue'

// Minimal bill fixture satisfying the full Tables<'bills'> Row shape.
function mkBill(
  id: string,
  name: string,
  budget_amount: number,
  due_day: number | null,
  is_active: boolean | null = true,
  frequency: string | null = null
): BillRow {
  return {
    id,
    name,
    budget_amount,
    budget_category_id: null,
    due_day,
    due_month_anchor: null,
    is_active,
    household_id: 'hh1',
    account: null,
    category: null,
    created_at: null,
    frequency,
    linked_debt_id: null,
    tier: null,
    seasonal_profile: null,
    exclude_from_forecast: false,
    notes: null,
  }
}

describe('comingDueWithin', () => {
  it('returns empty array for empty bills list', () => {
    const result = comingDueWithin([], { year: 2025, month: 5, day: 1 }, 14)
    expect(result).toEqual([])
  })

  it('skips inactive bills (false)', () => {
    const bills = [mkBill('b1', 'Rent', 1200, 1, false)]
    const result = comingDueWithin(bills, { year: 2025, month: 5, day: 1 }, 14)
    expect(result).toEqual([])
  })

  it('skips inactive bills (null)', () => {
    const bills = [mkBill('b1', 'Rent', 1200, 1, null)]
    const result = comingDueWithin(bills, { year: 2025, month: 5, day: 1 }, 14)
    expect(result).toEqual([])
  })

  it('skips bills with null due_day', () => {
    const bills = [mkBill('b1', 'Netflix', 15, null)]
    const result = comingDueWithin(bills, { year: 2025, month: 5, day: 1 }, 14)
    expect(result).toEqual([])
  })

  it('includes a bill due today with daysUntil = 0', () => {
    const from = { year: 2025, month: 5, day: 15 }
    const bills = [mkBill('b1', 'Car Payment', 450, 15)]
    const result = comingDueWithin(bills, from, 14)
    expect(result).toHaveLength(1)
    expect(result[0]!.daysUntil).toBe(0)
    expect(result[0]!.dueDate).toBe('2025-05-15')
  })

  it('includes a bill due in 7 days with correct daysUntil and dueDate', () => {
    const from = { year: 2025, month: 5, day: 8 }
    const bills = [mkBill('b1', 'Internet', 80, 15)]
    const result = comingDueWithin(bills, from, 14)
    expect(result).toHaveLength(1)
    expect(result[0]!.daysUntil).toBe(7)
    expect(result[0]!.dueDate).toBe('2025-05-15')
  })

  it('excludes a bill due in 30 days when withinDays=14', () => {
    const from = { year: 2025, month: 5, day: 1 }
    const bills = [mkBill('b1', 'Annual Fee', 100, 31)]
    const result = comingDueWithin(bills, from, 14)
    expect(result).toEqual([])
  })

  it('sorts multiple bills ascending by daysUntil', () => {
    const from = { year: 2025, month: 5, day: 1 }
    const bills = [
      mkBill('b3', 'Electric', 120, 20),   // 19 days away
      mkBill('b1', 'Rent', 1200, 1),        // 0 days (today)
      mkBill('b2', 'Internet', 80, 10),     // 9 days away
    ]
    const result = comingDueWithin(bills, from, 30)
    expect(result.map(r => r.billId)).toEqual(['b1', 'b2', 'b3'])
    expect(result.map(r => r.daysUntil)).toEqual([0, 9, 19])
  })

  it('handles clamped day for February (day=31 → day=28)', () => {
    const from = { year: 2025, month: 2, day: 20 }
    const bills = [mkBill('b1', 'Mortgage', 2000, 31)]
    const result = comingDueWithin(bills, from, 14)
    expect(result).toHaveLength(1)
    expect(result[0]!.dueDate).toBe('2025-02-28')
    expect(result[0]!.daysUntil).toBe(8)  // Feb 20 → Feb 28 = 8 days
  })

  it('crosses into next month when due_day already passed this month', () => {
    // from = May 20, due_day = 15 → already passed, so June 15
    const from = { year: 2025, month: 5, day: 20 }
    const bills = [mkBill('b1', 'Phone', 60, 15)]
    const result = comingDueWithin(bills, from, 30)
    expect(result).toHaveLength(1)
    expect(result[0]!.dueDate).toBe('2025-06-15')
    expect(result[0]!.daysUntil).toBe(26)  // May 20 → June 15 = 26 days
  })

  it('includes the correct amount and name in result', () => {
    const from = { year: 2025, month: 5, day: 1 }
    const bills = [mkBill('b1', 'Streaming', 14.99, 5)]
    const result = comingDueWithin(bills, from, 14)
    expect(result[0]!.name).toBe('Streaming')
    expect(result[0]!.amount).toBe(14.99)
    expect(result[0]!.billId).toBe('b1')
  })

  it('handles December to January month rollover for dueDate', () => {
    // from = Dec 25, due_day = 5 → already past in Dec, so Jan 5 next year
    const from = { year: 2025, month: 12, day: 25 }
    const bills = [mkBill('b1', 'Insurance', 150, 5)]
    const result = comingDueWithin(bills, from, 14)
    expect(result).toHaveLength(1)
    expect(result[0]!.dueDate).toBe('2026-01-05')
  })

  describe('biweekly bills', () => {
    it('emits TWO entries for the Church Tithe scenario (Biweekly + due_day=1) in a 14-day window starting day 1', () => {
      const from = { year: 2026, month: 6, day: 1 }
      const bills = [mkBill('b1', 'Church Tithe', 1000, 1, true, 'Biweekly')]
      const result = comingDueWithin(bills, from, 14)
      expect(result).toHaveLength(2)
      expect(result[0]!.daysUntil).toBe(0)
      expect(result[0]!.dueDate).toBe('2026-06-01')
      expect(result[1]!.daysUntil).toBe(14)
      expect(result[1]!.dueDate).toBe('2026-06-15')
    })

    it('emits only ONE entry per month for a Monthly bill (back-compat)', () => {
      const from = { year: 2026, month: 6, day: 1 }
      const bills = [mkBill('b1', 'Mortgage', 2469.40, 1, true, 'Monthly')]
      const result = comingDueWithin(bills, from, 14)
      expect(result).toHaveLength(1)
      expect(result[0]!.daysUntil).toBe(0)
    })

    it('emits only the first occurrence for biweekly when the second falls outside the window', () => {
      // Window: Jun 5 → Jun 12 (7 days). Bill due_day=10 biweekly → first
      // occurrence Jun 10 (in window), second occurrence Jun 24 (outside).
      const from = { year: 2026, month: 6, day: 5 }
      const bills = [mkBill('b1', 'Bi', 50, 10, true, 'Biweekly')]
      const result = comingDueWithin(bills, from, 7)
      expect(result).toHaveLength(1)
      expect(result[0]!.dueDate).toBe('2026-06-10')
    })

    it('still works for Semi-monthly / Semimonthly frequency strings', () => {
      for (const freq of ['Semi-monthly', 'Semimonthly']) {
        const result = comingDueWithin(
          [mkBill('b1', 'Bi', 100, 1, true, freq)],
          { year: 2026, month: 6, day: 1 },
          14
        )
        expect(result.map(r => r.dueDate)).toEqual(['2026-06-01', '2026-06-15'])
      }
    })

    it('sorts biweekly + monthly entries together by daysUntil ascending', () => {
      const from = { year: 2026, month: 6, day: 1 }
      const bills = [
        mkBill('b1', 'Church Tithe', 1000, 1, true, 'Biweekly'),
        mkBill('b2', 'Electric', 220, 2, true, 'Monthly'),
        mkBill('b3', 'Other Monthly', 50, 14, true, 'Monthly')
      ]
      const result = comingDueWithin(bills, from, 14)
      expect(result.map(r => `${r.daysUntil}:${r.name}`)).toEqual([
        '0:Church Tithe',
        '1:Electric',
        '13:Other Monthly',
        '14:Church Tithe'
      ])
    })
  })
})
