import type { Callout } from '@/lib/briefing/notable'
import type { BillDueItem } from '@/lib/briefing/comingDue'

export const FIXTURE_TODAY = { year: 2026, month: 5, day: 24 }
export const FIXTURE_TODAY_LABEL = 'SAT, MAY 24'

export const FIXTURE_KPIS = {
  cash: 63532,
  debt: 18902,
  thisMonthNet: -10503,
  // additional metrics for the dashboard variant
  income: 63532,
  expenses: 74847,
  netCashFlow: -10503,
  savingsRate: -0.165,        // -16.5%
  plannedIncome: 63808,
  projectedNet: 20009,
  targetSavings: 0.314,       // 31.4%
  incomeVariance: -276
}

export const FIXTURE_COMING_DUE: ReadonlyArray<BillDueItem> = [
  { billId: '1', name: 'Tucker, mortgage', amount: 2140, daysUntil: 3, dueDate: '2026-05-27' },
  { billId: '2', name: 'Anthropic', amount: 200, daysUntil: 6, dueDate: '2026-05-30' },
  { billId: '3', name: 'FirstEnergy', amount: 184, daysUntil: 9, dueDate: '2026-06-02' },
  { billId: '4', name: 'NRA Membership', amount: 45, daysUntil: 11, dueDate: '2026-06-04' },
  { billId: '5', name: 'Spectrum', amount: 110, daysUntil: 13, dueDate: '2026-06-06' }
]

export const FIXTURE_FORECAST_POINTS: ReadonlyArray<number> = [
  63532, 63332, 62932, 62832, 60692, 60492, 60292, 61292, 61092, 60892,
  60692, 60492, 60292, 60092, 59892, 59692, 59492, 64492, 64292, 64092,
  63892, 63692, 63492, 63292, 63092, 62892, 62692, 62492, 62292, 62092
]

export const FIXTURE_NOTABLE: ReadonlyArray<Callout> = [
  {
    kind: 'duplicate_charge',
    lead: 'Duplicate charge.',
    body: 'Anthropic billed twice on May 18 — $200 each.',
    impact: 200
  },
  {
    kind: 'category_swing',
    lead: 'Groceries up 22%.',
    body: '$842 this month vs $688 trailing average.',
    impact: 154
  },
  {
    kind: 'slipped_bill',
    lead: 'Internet appears unpaid.',
    body: 'Due May 20 ($89); no matching transaction in the last 3 days.',
    impact: 89
  }
]

export const FIXTURE_LEAD = {
  headline: 'Net cash flow down $10,503 this month.',
  standfirst:
    'Cash $63,532 · debt $18,902. Three bills slipped into June; Anthropic billed twice.'
}
