import { describe, it, expect } from 'vitest'
import { billsForCategory, type BillForCategory } from './billsForCategory'

const HID = '00000000-0000-0000-0000-000000000001'

function bill(over: Partial<BillForCategory> = {}): BillForCategory {
  return {
    id: 'b1',
    name: 'Bill 1',
    budget_amount: 100,
    budget_category_id: 'cat-h',
    is_active: true,
    frequency: 'Monthly',
    due_day: 1,
    due_month_anchor: null,
    account: null,
    created_at: null,
    ...over
  }
}

void HID

describe('billsForCategory', () => {
  it('returns [] when categoryId is null', () => {
    expect(billsForCategory({
      bills: [bill()],
      categoryId: null,
      period: { year: 2026, month: 6 }
    })).toEqual([])
  })

  it('filters out inactive bills', () => {
    const result = billsForCategory({
      bills: [bill({ is_active: false })],
      categoryId: 'cat-h',
      period: { year: 2026, month: 6 }
    })
    expect(result).toEqual([])
  })

  it('filters out bills mapped to other categories', () => {
    const result = billsForCategory({
      bills: [bill({ budget_category_id: 'cat-other' })],
      categoryId: 'cat-h',
      period: { year: 2026, month: 6 }
    })
    expect(result).toEqual([])
  })

  it('returns a monthly bill in every month with ×1 occurrence', () => {
    const result = billsForCategory({
      bills: [bill({ id: 'm', name: 'Mortgage', budget_amount: 2469.40 })],
      categoryId: 'cat-h',
      period: { year: 2026, month: 8 }
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'm',
      name: 'Mortgage',
      perOccurrenceAmount: 2469.40,
      occurrenceCount: 1,
      contribution: 2469.40
    })
  })

  it('returns biweekly bills with ×2 occurrence', () => {
    const result = billsForCategory({
      bills: [bill({ id: 'biw', name: 'Tithe', budget_amount: 250, frequency: 'Biweekly', due_day: 1 })],
      categoryId: 'cat-h',
      period: { year: 2026, month: 6 }
    })
    expect(result[0]).toMatchObject({
      occurrenceCount: 2,
      contribution: 500
    })
  })

  it('includes a quarterly bill in its anchor month', () => {
    // Anchor Sep → Sep/Dec/Mar/Jun
    const result = billsForCategory({
      bills: [
        bill({ id: 'q', name: 'Interstate Waste', budget_amount: 105, frequency: 'Quarterly', due_day: 1, due_month_anchor: 9 })
      ],
      categoryId: 'cat-h',
      period: { year: 2026, month: 9 }
    })
    expect(result[0]).toMatchObject({
      id: 'q',
      occurrenceCount: 1,
      contribution: 105
    })
  })

  it('excludes a quarterly bill from off-quarter months', () => {
    const result = billsForCategory({
      bills: [
        bill({ id: 'q', name: 'Interstate Waste', budget_amount: 105, frequency: 'Quarterly', due_day: 1, due_month_anchor: 9 })
      ],
      categoryId: 'cat-h',
      period: { year: 2026, month: 8 }
    })
    expect(result).toEqual([])
  })

  it('excludes a quarterly bill when anchor is null (unscheduled)', () => {
    const result = billsForCategory({
      bills: [
        bill({ id: 'q', frequency: 'Quarterly', due_month_anchor: null })
      ],
      categoryId: 'cat-h',
      period: { year: 2026, month: 9 }
    })
    expect(result).toEqual([])
  })

  it('sorts by contribution desc, then name asc', () => {
    const result = billsForCategory({
      bills: [
        bill({ id: 'm', name: 'Mortgage',  budget_amount: 2469.40, frequency: 'Monthly',  due_day: 1 }),
        bill({ id: 'q', name: 'Interstate Waste', budget_amount: 105, frequency: 'Quarterly', due_day: 1, due_month_anchor: 9 }),
        bill({ id: 'm2', name: 'Maintenance', budget_amount: 105, frequency: 'Monthly', due_day: 15 })
      ],
      categoryId: 'cat-h',
      period: { year: 2026, month: 9 }
    })
    expect(result.map(r => r.id)).toEqual(['m', 'q', 'm2'])
    // 'm' is far larger; the two $105 contributions tie by amount, then sort by name:
    // 'Interstate Waste' < 'Maintenance'
  })

  it('mirrors the Sep+Dec mortgage+quarterly arithmetic that deriveBudgetVsActual uses', () => {
    const bills = [
      bill({ id: 'm', name: 'Mortgage',  budget_amount: 2469.40, frequency: 'Monthly',  due_day: 1 }),
      bill({ id: 'q', name: 'Interstate Waste', budget_amount: 105, frequency: 'Quarterly', due_day: 1, due_month_anchor: 9 })
    ]
    const sep = billsForCategory({ bills, categoryId: 'cat-h', period: { year: 2026, month: 9 } })
    const oct = billsForCategory({ bills, categoryId: 'cat-h', period: { year: 2026, month: 10 } })
    expect(sep.reduce((s, r) => s + r.contribution, 0)).toBe(2574.40)
    expect(oct.reduce((s, r) => s + r.contribution, 0)).toBe(2469.40)
  })
})
