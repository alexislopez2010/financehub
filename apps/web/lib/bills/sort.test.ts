import { describe, it, expect } from 'vitest'
import { parseSortKey, billComparator, nextDueDate, type BillRow } from './sort'

const TODAY = { year: 2026, month: 5, day: 15 }

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    household_id: 'h',
    name: 'Test',
    category: 'Housing',
    account: null,
    due_day: 15,
    due_month_anchor: null,
    frequency: 'Monthly',
    budget_amount: 100,
    budget_category_id: null,
    is_active: true,
    notes: null,
    linked_debt_id: null,
    tier: null,
    seasonal_profile: null,
    exclude_from_forecast: false,
    created_at: null,
    ...over
  }
}

describe('parseSortKey', () => {
  it('parses all four valid keys', () => {
    expect(parseSortKey('due')).toBe('due')
    expect(parseSortKey('amount')).toBe('amount')
    expect(parseSortKey('name')).toBe('name')
    expect(parseSortKey('category')).toBe('category')
  })
  it('returns undefined for invalid', () => {
    expect(parseSortKey('garbage')).toBeUndefined()
    expect(parseSortKey(null)).toBeUndefined()
    expect(parseSortKey('')).toBeUndefined()
  })
})

describe('billComparator', () => {
  it('due: sorts ascending by days until due', () => {
    const list = [
      bill({ id: 'far', due_day: 28 }),       // due in 13 days
      bill({ id: 'near', due_day: 17 }),      // due in 2 days
      bill({ id: 'today', due_day: 15 })      // due today (0)
    ]
    list.sort(billComparator('due', TODAY))
    expect(list.map(b => b.id)).toEqual(['today', 'near', 'far'])
  })
  it('due: null due_day sorts last', () => {
    const list = [
      bill({ id: 'null', due_day: null }),
      bill({ id: 'valid', due_day: 17 })
    ]
    list.sort(billComparator('due', TODAY))
    expect(list.map(b => b.id)).toEqual(['valid', 'null'])
  })
  it('amount: sorts descending by budget_amount', () => {
    const list = [
      bill({ id: 'small', budget_amount: 50 }),
      bill({ id: 'big', budget_amount: 500 }),
      bill({ id: 'med', budget_amount: 200 })
    ]
    list.sort(billComparator('amount', TODAY))
    expect(list.map(b => b.id)).toEqual(['big', 'med', 'small'])
  })
  it('name: sorts ascending alphabetically', () => {
    const list = [
      bill({ id: 'c', name: 'Charlie' }),
      bill({ id: 'a', name: 'Alpha' }),
      bill({ id: 'b', name: 'Bravo' })
    ]
    list.sort(billComparator('name', TODAY))
    expect(list.map(b => b.id)).toEqual(['a', 'b', 'c'])
  })
  it('category: sorts ascending alphabetically with null last (empty string sorts first actually)', () => {
    const list = [
      bill({ id: 't', category: 'Transportation' }),
      bill({ id: 'h', category: 'Housing' }),
      bill({ id: 'n', category: null })
    ]
    list.sort(billComparator('category', TODAY))
    // Empty string '' sorts before any letter — null treated as ''
    expect(list[0]!.id).toBe('n')
    expect(list[1]!.id).toBe('h')
    expect(list[2]!.id).toBe('t')
  })
  it('stable secondary sort by name on ties', () => {
    const list = [
      bill({ id: 'a', name: 'Banana', budget_amount: 100 }),
      bill({ id: 'b', name: 'Apple',  budget_amount: 100 })
    ]
    list.sort(billComparator('amount', TODAY))
    expect(list[0]!.name).toBe('Apple')
    expect(list[1]!.name).toBe('Banana')
  })
})

describe('nextDueDate', () => {
  it('returns null for null due_day', () => {
    expect(nextDueDate(bill({ due_day: null }), TODAY)).toBeNull()
  })
  it('returns this month when due_day is today or future', () => {
    expect(nextDueDate(bill({ due_day: 15 }), TODAY)).toBe('2026-05-15')
    expect(nextDueDate(bill({ due_day: 28 }), TODAY)).toBe('2026-05-28')
  })
  it('returns next month when due_day is past', () => {
    expect(nextDueDate(bill({ due_day: 10 }), TODAY)).toBe('2026-06-10')
  })
  it('clamps day=31 to short months', () => {
    // From Feb 1, next due_day=31 → Feb 28 (2025 non-leap)
    expect(nextDueDate(bill({ due_day: 31 }), { year: 2025, month: 2, day: 1 })).toBe('2025-02-28')
    // From Feb 1, 2024 (leap year) → Feb 29
    expect(nextDueDate(bill({ due_day: 31 }), { year: 2024, month: 2, day: 1 })).toBe('2024-02-29')
  })
  it('rolls year on Dec → Jan', () => {
    // From Dec 30, due_day=15 → Jan 15
    expect(nextDueDate(bill({ due_day: 15 }), { year: 2025, month: 12, day: 30 })).toBe('2026-01-15')
  })

  // The original Interstate Waste Services bug: a Quarterly bill anchored to
  // September was showing "due July 1" from a June reference date, because
  // the row label only walked one nominal day-of-month ahead. Cadence-aware
  // path must skip July/August and land on September 1.
  it('respects Quarterly cadence with anchor month', () => {
    const quarterly = bill({
      due_day: 1,
      frequency: 'Quarterly',
      due_month_anchor: 9
    })
    expect(nextDueDate(quarterly, { year: 2026, month: 6, day: 5 })).toBe('2026-09-01')
    // Sitting in September on or before the due day → returns same month.
    expect(nextDueDate(quarterly, { year: 2026, month: 9, day: 1 })).toBe('2026-09-01')
    // Past September's hit → next quarterly stop is December.
    expect(nextDueDate(quarterly, { year: 2026, month: 9, day: 2 })).toBe('2026-12-01')
    // Past December's hit → wraps into next year's March (anchor + 6).
    expect(nextDueDate(quarterly, { year: 2026, month: 12, day: 2 })).toBe('2027-03-01')
  })

  it('respects Annual cadence with anchor month', () => {
    const annual = bill({
      due_day: 15,
      frequency: 'Annual',
      due_month_anchor: 4
    })
    expect(nextDueDate(annual, { year: 2026, month: 6, day: 5 })).toBe('2027-04-15')
    expect(nextDueDate(annual, { year: 2026, month: 4, day: 14 })).toBe('2026-04-15')
    expect(nextDueDate(annual, { year: 2026, month: 4, day: 16 })).toBe('2027-04-15')
  })

  it('returns null for Quarterly with no anchor month (unscheduled)', () => {
    expect(nextDueDate(
      bill({ due_day: 1, frequency: 'Quarterly', due_month_anchor: null }),
      TODAY
    )).toBeNull()
  })
})

describe('billComparator — cadence-aware due sort', () => {
  const TODAY_JUN5 = { year: 2026, month: 6, day: 5 }

  it('sorts a Quarterly Sep-anchored bill AFTER a Monthly day-1 bill', () => {
    // Monthly day-1 from June 5 → July 1 (26 days)
    // Quarterly Sep-anchored from June 5 → Sep 1 (88 days)
    // So 'monthly' should sort before 'quarterly'.
    const list = [
      bill({ id: 'quarterly', name: 'Quarterly bill', due_day: 1, frequency: 'Quarterly', due_month_anchor: 9 }),
      bill({ id: 'monthly',   name: 'Monthly bill',   due_day: 1, frequency: 'Monthly' })
    ]
    list.sort(billComparator('due', TODAY_JUN5))
    expect(list.map(b => b.id)).toEqual(['monthly', 'quarterly'])
  })

  it('puts Quarterly without anchor LAST (treated as unscheduled)', () => {
    const list = [
      bill({ id: 'no-anchor', name: 'A bill',  due_day: 1, frequency: 'Quarterly', due_month_anchor: null }),
      bill({ id: 'scheduled', name: 'B bill', due_day: 5, frequency: 'Monthly' })
    ]
    list.sort(billComparator('due', TODAY_JUN5))
    expect(list.map(b => b.id)).toEqual(['scheduled', 'no-anchor'])
  })
})
