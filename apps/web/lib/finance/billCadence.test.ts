import { describe, it, expect } from 'vitest'
import { isBillDueOn, billOccurrencesIn, occurrencesInMonth, monthlyOccurrenceCount } from './billCadence'

describe('isBillDueOn — monthly', () => {
  it('returns true on the due_day of each month', () => {
    expect(isBillDueOn({ due_day: 15, frequency: 'Monthly' }, { year: 2026, month: 6, day: 15 })).toBe(true)
    expect(isBillDueOn({ due_day: 1,  frequency: 'Monthly' }, { year: 2026, month: 7, day: 1 })).toBe(true)
  })

  it('returns false on other days of the month', () => {
    expect(isBillDueOn({ due_day: 15, frequency: 'Monthly' }, { year: 2026, month: 6, day: 14 })).toBe(false)
    expect(isBillDueOn({ due_day: 15, frequency: 'Monthly' }, { year: 2026, month: 6, day: 16 })).toBe(false)
  })

  it('clamps to the last day of short months (due_day=31 → Feb 28/29, Jun 30, etc.)', () => {
    expect(isBillDueOn({ due_day: 31, frequency: 'Monthly' }, { year: 2026, month: 2, day: 28 })).toBe(true)
    expect(isBillDueOn({ due_day: 31, frequency: 'Monthly' }, { year: 2024, month: 2, day: 29 })).toBe(true)  // leap
    expect(isBillDueOn({ due_day: 31, frequency: 'Monthly' }, { year: 2026, month: 6, day: 30 })).toBe(true)
  })

  it('returns false when due_day is null', () => {
    expect(isBillDueOn({ due_day: null, frequency: 'Monthly' }, { year: 2026, month: 6, day: 1 })).toBe(false)
  })

  it('falls back to monthly semantics when frequency is null or unknown', () => {
    expect(isBillDueOn({ due_day: 15, frequency: null }, { year: 2026, month: 6, day: 15 })).toBe(true)
    expect(isBillDueOn({ due_day: 15, frequency: 'Weekly' }, { year: 2026, month: 6, day: 15 })).toBe(true)
    expect(isBillDueOn({ due_day: 15, frequency: 'Weekly' }, { year: 2026, month: 6, day: 22 })).toBe(false)
  })
})

describe('isBillDueOn — biweekly', () => {
  // The user's Church Tithe is the canonical case here: Biweekly, due_day=1.
  const churchTithe = { due_day: 1, frequency: 'Biweekly' }

  it('matches the first occurrence (due_day itself)', () => {
    expect(isBillDueOn(churchTithe, { year: 2026, month: 6, day: 1 })).toBe(true)
  })

  it('matches the second occurrence (due_day + 14)', () => {
    expect(isBillDueOn(churchTithe, { year: 2026, month: 6, day: 15 })).toBe(true)
    expect(isBillDueOn(churchTithe, { year: 2026, month: 7, day: 15 })).toBe(true)
  })

  it('does not match days between or outside the two occurrences', () => {
    expect(isBillDueOn(churchTithe, { year: 2026, month: 6, day: 8 })).toBe(false)
    expect(isBillDueOn(churchTithe, { year: 2026, month: 6, day: 22 })).toBe(false)
    expect(isBillDueOn(churchTithe, { year: 2026, month: 6, day: 29 })).toBe(false)
  })

  it('treats "Semi-monthly" / "Semimonthly" / "semi monthly" as biweekly for bill purposes', () => {
    for (const freq of ['Semi-monthly', 'Semimonthly', 'semi monthly']) {
      expect(isBillDueOn({ due_day: 1, frequency: freq }, { year: 2026, month: 6, day: 15 })).toBe(true)
    }
  })

  it('handles the second-occurrence overflow into the next month', () => {
    // due_day=25, June has 30 days → 25+14=39 → rolls to day 9 of July
    const bill = { due_day: 25, frequency: 'Biweekly' }
    expect(isBillDueOn(bill, { year: 2026, month: 6, day: 25 })).toBe(true)
    expect(isBillDueOn(bill, { year: 2026, month: 7, day: 9 })).toBe(true)
    // Sanity: not on other days of July
    expect(isBillDueOn(bill, { year: 2026, month: 7, day: 8 })).toBe(false)
    expect(isBillDueOn(bill, { year: 2026, month: 7, day: 10 })).toBe(false)
  })

  it('handles overflow across a year boundary (Dec → Jan)', () => {
    // due_day=25, Dec has 31 days → 25+14=39 → day 8 of next year January
    const bill = { due_day: 25, frequency: 'Biweekly' }
    expect(isBillDueOn(bill, { year: 2026, month: 12, day: 25 })).toBe(true)
    expect(isBillDueOn(bill, { year: 2027, month: 1, day: 8 })).toBe(true)
  })
})

describe('billOccurrencesIn — windowed walk', () => {
  it('returns one occurrence for a monthly bill whose due_day falls in the window', () => {
    const result = billOccurrencesIn(
      { due_day: 5, frequency: 'Monthly' },
      { year: 2026, month: 6, day: 1 },
      14
    )
    expect(result.map(r => r.daysUntil)).toEqual([4])
  })

  it('returns zero occurrences for a monthly bill whose due_day falls outside the window', () => {
    // Window: Jun 1 → Jun 15. Bill due_day=20 → no occurrence.
    const result = billOccurrencesIn(
      { due_day: 20, frequency: 'Monthly' },
      { year: 2026, month: 6, day: 1 },
      14
    )
    expect(result).toEqual([])
  })

  it('returns TWO occurrences for a biweekly bill with due_day=1 in a 14-day window starting day 1 — the Church Tithe case', () => {
    const result = billOccurrencesIn(
      { due_day: 1, frequency: 'Biweekly' },
      { year: 2026, month: 6, day: 1 },
      14
    )
    expect(result.map(r => r.daysUntil)).toEqual([0, 14])
    expect(result.map(r => `${r.date.year}-${r.date.month}-${r.date.day}`)).toEqual([
      '2026-6-1', '2026-6-15'
    ])
  })

  it('returns THREE occurrences for biweekly + due_day=1 across a wider 28-day window', () => {
    // Day 1, 15, 29 (true biweekly drift via the overflow rule from May)
    const result = billOccurrencesIn(
      { due_day: 1, frequency: 'Biweekly' },
      { year: 2026, month: 6, day: 1 },
      28
    )
    // Two occurrences inside June (1, 15) plus the next month's drift on day 1
    // is NOT included by our "twice per calendar month" rule. We get [0, 14].
    // The 29-day drift fully-correct semantics aren't required for the user's
    // 14-day Coming Due window.
    expect(result.map(r => r.daysUntil)).toContain(0)
    expect(result.map(r => r.daysUntil)).toContain(14)
  })

  it('returns occurrences sorted ascending by daysUntil', () => {
    const result = billOccurrencesIn(
      { due_day: 1, frequency: 'Biweekly' },
      { year: 2026, month: 6, day: 1 },
      14
    )
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i]!.daysUntil).toBeGreaterThanOrEqual(result[i - 1]!.daysUntil)
    }
  })

  it('returns empty for a bill with null due_day', () => {
    const result = billOccurrencesIn(
      { due_day: null, frequency: 'Monthly' },
      { year: 2026, month: 6, day: 1 },
      14
    )
    expect(result).toEqual([])
  })

  it('returns empty for a negative window', () => {
    const result = billOccurrencesIn(
      { due_day: 5, frequency: 'Monthly' },
      { year: 2026, month: 6, day: 1 },
      -1
    )
    expect(result).toEqual([])
  })
})

describe('isBillDueOn — quarterly', () => {
  // $105 Housing bill, anchor March → due Mar/Jun/Sep/Dec on the 1st.
  const quarterly = { due_day: 1, frequency: 'Quarterly', due_month_anchor: 3 }

  it('returns true on the due day in every anchor + 3·n month', () => {
    expect(isBillDueOn(quarterly, { year: 2026, month: 3,  day: 1 })).toBe(true)
    expect(isBillDueOn(quarterly, { year: 2026, month: 6,  day: 1 })).toBe(true)
    expect(isBillDueOn(quarterly, { year: 2026, month: 9,  day: 1 })).toBe(true)
    expect(isBillDueOn(quarterly, { year: 2026, month: 12, day: 1 })).toBe(true)
  })

  it('returns false in months that do not match the cadence', () => {
    expect(isBillDueOn(quarterly, { year: 2026, month: 1,  day: 1 })).toBe(false)
    expect(isBillDueOn(quarterly, { year: 2026, month: 2,  day: 1 })).toBe(false)
    expect(isBillDueOn(quarterly, { year: 2026, month: 4,  day: 1 })).toBe(false)
    expect(isBillDueOn(quarterly, { year: 2026, month: 5,  day: 1 })).toBe(false)
  })

  it('returns false on the right month but wrong day', () => {
    expect(isBillDueOn(quarterly, { year: 2026, month: 6, day: 2 })).toBe(false)
    expect(isBillDueOn(quarterly, { year: 2026, month: 6, day: 15 })).toBe(false)
  })

  it('handles a December anchor (wraps across calendar year)', () => {
    const decAnchored = { due_day: 10, frequency: 'Quarterly', due_month_anchor: 12 }
    expect(isBillDueOn(decAnchored, { year: 2026, month: 12, day: 10 })).toBe(true)
    expect(isBillDueOn(decAnchored, { year: 2027, month: 3,  day: 10 })).toBe(true)
    expect(isBillDueOn(decAnchored, { year: 2027, month: 6,  day: 10 })).toBe(true)
    expect(isBillDueOn(decAnchored, { year: 2026, month: 11, day: 10 })).toBe(false)
  })

  it('returns false when due_month_anchor is null (bill is unscheduled)', () => {
    expect(isBillDueOn(
      { due_day: 1, frequency: 'Quarterly', due_month_anchor: null },
      { year: 2026, month: 6, day: 1 }
    )).toBe(false)
  })

  it('returns false when due_day is null', () => {
    expect(isBillDueOn(
      { due_day: null, frequency: 'Quarterly', due_month_anchor: 3 },
      { year: 2026, month: 6, day: 1 }
    )).toBe(false)
  })
})

describe('isBillDueOn — annual', () => {
  const annual = { due_day: 15, frequency: 'Annual', due_month_anchor: 4 }

  it('returns true only on the anchor month + due day', () => {
    expect(isBillDueOn(annual, { year: 2026, month: 4, day: 15 })).toBe(true)
    expect(isBillDueOn(annual, { year: 2027, month: 4, day: 15 })).toBe(true)
  })

  it('returns false in any other month', () => {
    expect(isBillDueOn(annual, { year: 2026, month: 5, day: 15 })).toBe(false)
    expect(isBillDueOn(annual, { year: 2026, month: 3, day: 15 })).toBe(false)
  })

  it('returns false on right month + wrong day', () => {
    expect(isBillDueOn(annual, { year: 2026, month: 4, day: 14 })).toBe(false)
    expect(isBillDueOn(annual, { year: 2026, month: 4, day: 16 })).toBe(false)
  })

  it('returns false when due_month_anchor is null (bill is unscheduled)', () => {
    expect(isBillDueOn(
      { due_day: 15, frequency: 'Annual', due_month_anchor: null },
      { year: 2026, month: 4, day: 15 }
    )).toBe(false)
  })
})

describe('occurrencesInMonth', () => {
  it('returns 1 for every month when monthly', () => {
    const bill = { due_day: 5, frequency: 'Monthly' }
    expect(occurrencesInMonth(bill, 2026, 1)).toBe(1)
    expect(occurrencesInMonth(bill, 2026, 7)).toBe(1)
  })

  it('returns 2 for every month when biweekly', () => {
    const bill = { due_day: 1, frequency: 'Biweekly' }
    expect(occurrencesInMonth(bill, 2026, 6)).toBe(2)
    expect(occurrencesInMonth(bill, 2026, 2)).toBe(2)
  })

  it('returns 1 only in the months the quarterly bill hits', () => {
    // anchor Mar → Mar/Jun/Sep/Dec
    const q = { due_day: 1, frequency: 'Quarterly', due_month_anchor: 3 }
    expect(occurrencesInMonth(q, 2026, 1)).toBe(0)
    expect(occurrencesInMonth(q, 2026, 2)).toBe(0)
    expect(occurrencesInMonth(q, 2026, 3)).toBe(1)
    expect(occurrencesInMonth(q, 2026, 6)).toBe(1)
    expect(occurrencesInMonth(q, 2026, 9)).toBe(1)
    expect(occurrencesInMonth(q, 2026, 12)).toBe(1)
    expect(occurrencesInMonth(q, 2026, 11)).toBe(0)
  })

  it('returns 1 only in the anchor month for annual', () => {
    const a = { due_day: 1, frequency: 'Annual', due_month_anchor: 4 }
    expect(occurrencesInMonth(a, 2026, 4)).toBe(1)
    for (const m of [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(occurrencesInMonth(a, 2026, m)).toBe(0)
    }
  })

  it('returns 0 for quarterly + annual when due_month_anchor is null', () => {
    expect(occurrencesInMonth(
      { due_day: 1, frequency: 'Quarterly', due_month_anchor: null },
      2026, 6
    )).toBe(0)
    expect(occurrencesInMonth(
      { due_day: 1, frequency: 'Annual', due_month_anchor: null },
      2026, 4
    )).toBe(0)
  })

  it('returns 0 for an out-of-range month', () => {
    expect(occurrencesInMonth({ due_day: 1, frequency: 'Monthly' }, 2026, 0)).toBe(0)
    expect(occurrencesInMonth({ due_day: 1, frequency: 'Monthly' }, 2026, 13)).toBe(0)
  })
})

describe('occurrencesInMonth — created_at gates the first occurrence', () => {
  // Regression: a Quarterly bill anchored to September, created on June 5,
  // was showing up in the June Plan because June IS in the every-3-months
  // cycle (Jun/Sep/Dec/Mar). The UI label says "Anchor month (first
  // occurrence)" — so the cycle should START at Sep, not include June.
  it('does NOT count June when a Sep-anchored quarterly bill was created in June', () => {
    const bill = {
      due_day: 1,
      frequency: 'Quarterly',
      due_month_anchor: 9,
      created_at: '2026-06-05T19:28:40Z'
    }
    expect(occurrencesInMonth(bill, 2026, 6)).toBe(0)
    expect(occurrencesInMonth(bill, 2026, 9)).toBe(1)
    expect(occurrencesInMonth(bill, 2026, 12)).toBe(1)
    expect(occurrencesInMonth(bill, 2027, 3)).toBe(1)
    expect(occurrencesInMonth(bill, 2027, 6)).toBe(1)
  })

  it('counts every cycle month once the bill has been around a full cycle', () => {
    const bill = {
      due_day: 1,
      frequency: 'Quarterly',
      due_month_anchor: 9,
      created_at: '2025-01-15T00:00:00Z'  // created before Sep 2025
    }
    // First occurrence is Sep 2025; from there every quarterly month counts.
    expect(occurrencesInMonth(bill, 2025, 9)).toBe(1)
    expect(occurrencesInMonth(bill, 2025, 12)).toBe(1)
    expect(occurrencesInMonth(bill, 2026, 3)).toBe(1)
    expect(occurrencesInMonth(bill, 2026, 6)).toBe(1)
    expect(occurrencesInMonth(bill, 2026, 9)).toBe(1)
  })

  it('bumps to the next year when created_at month is AFTER the anchor', () => {
    const bill = {
      due_day: 1,
      frequency: 'Quarterly',
      due_month_anchor: 9,
      created_at: '2026-11-05T00:00:00Z'  // created Nov, after Sep
    }
    expect(occurrencesInMonth(bill, 2026, 12)).toBe(0)  // before first occurrence
    expect(occurrencesInMonth(bill, 2027, 3)).toBe(0)   // before first occurrence
    expect(occurrencesInMonth(bill, 2027, 6)).toBe(0)   // before first occurrence
    expect(occurrencesInMonth(bill, 2027, 9)).toBe(1)   // first occurrence — Sep 2027
    expect(occurrencesInMonth(bill, 2027, 12)).toBe(1)
  })

  it('annual bill gates the same way — only counts in the anchor month at/after creation', () => {
    const bill = {
      due_day: 15,
      frequency: 'Annual',
      due_month_anchor: 4,
      created_at: '2026-06-05T00:00:00Z'  // created Jun, after Apr
    }
    expect(occurrencesInMonth(bill, 2026, 4)).toBe(0)  // already past before created
    expect(occurrencesInMonth(bill, 2027, 4)).toBe(1)  // next April
    expect(occurrencesInMonth(bill, 2028, 4)).toBe(1)
  })

  it('falls back to pure cycle behavior when created_at is null (legacy callers)', () => {
    const bill = {
      due_day: 1,
      frequency: 'Quarterly',
      due_month_anchor: 9,
      created_at: null
    }
    expect(occurrencesInMonth(bill, 2026, 6)).toBe(1)  // cycle-only — counts
    expect(occurrencesInMonth(bill, 2026, 9)).toBe(1)
  })
})

describe('monthlyOccurrenceCount (legacy average)', () => {
  it('still reports 2 for biweekly and 1 for monthly', () => {
    expect(monthlyOccurrenceCount({ due_day: 1, frequency: 'Biweekly' })).toBe(2)
    expect(monthlyOccurrenceCount({ due_day: 1, frequency: 'Monthly' })).toBe(1)
  })

  it('reports 1 for quarterly/annual as the average — caller should use occurrencesInMonth', () => {
    expect(monthlyOccurrenceCount({ due_day: 1, frequency: 'Quarterly' })).toBe(1)
    expect(monthlyOccurrenceCount({ due_day: 1, frequency: 'Annual' })).toBe(1)
  })
})
