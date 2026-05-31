import { describe, it, expect } from 'vitest'
import type { Tables } from '@/lib/supabase/database.types'
import { findOrphanBills } from './orphanBills'

const HID = '00000000-0000-0000-0000-000000000001'

type BillRow = Tables<'bills'>
type BudgetRow = Tables<'budgets'>
type CategoryRow = Tables<'categories'>

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'bill-1',
    household_id: HID,
    name: 'Electric',
    category: null,
    budget_category_id: 'cat-elec',
    budget_amount: 120,
    due_day: 5,
    frequency: 'monthly',
    account: null,
    is_active: true,
    created_at: null,
    linked_debt_id: null,
    notes: null,
    ...over
  } as BillRow
}

function budget(over: Partial<BudgetRow> = {}): BudgetRow {
  return {
    id: 'b-1',
    household_id: HID,
    category: 'Electricity',
    category_id: 'cat-elec',
    amount: 100,
    year: 2026,
    month: 6,
    sub_category: null,
    created_at: null,
    ...over
  } as BudgetRow
}

function cat(over: Partial<Pick<CategoryRow, 'id' | 'name'>> = {}): Pick<CategoryRow, 'id' | 'name'> {
  return { id: 'cat-elec', name: 'Electricity', ...over }
}

const period = { year: 2026, month: 6 }

describe('findOrphanBills', () => {
  it('returns [] when no bills are mapped (budget_category_id all null)', () => {
    const result = findOrphanBills({
      bills: [
        bill({ id: 'b1', budget_category_id: null }),
        bill({ id: 'b2', budget_category_id: null })
      ],
      budgets: [],
      categories: [cat()],
      period
    })
    expect(result).toEqual([])
  })

  it('returns [] when all mapped bills have a budget row for the period', () => {
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', budget_category_id: 'cat-elec' })],
      budgets: [budget({ category_id: 'cat-elec' })],
      categories: [cat()],
      period
    })
    expect(result).toEqual([])
  })

  it('includes a bill when its mapped category has no budget row for this month', () => {
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', name: 'Electric', budget_category_id: 'cat-elec' })],
      budgets: [],
      categories: [cat({ id: 'cat-elec', name: 'Electricity' })],
      period
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.bill.id).toBe('b1')
    expect(result[0]!.category).toEqual({ id: 'cat-elec', name: 'Electricity' })
  })

  it('excludes a bill when its category has a budget row even if amount is 0', () => {
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', budget_category_id: 'cat-elec' })],
      budgets: [budget({ category_id: 'cat-elec', amount: 0 })],
      categories: [cat()],
      period
    })
    expect(result).toEqual([])
  })

  it('excludes inactive bills', () => {
    const result = findOrphanBills({
      bills: [
        bill({ id: 'b1', is_active: false, budget_category_id: 'cat-elec' }),
        bill({ id: 'b2', is_active: null, budget_category_id: 'cat-elec' })
      ],
      budgets: [],
      categories: [cat()],
      period
    })
    expect(result).toEqual([])
  })

  it('excludes bills with budget_category_id=null even when no budget exists', () => {
    const result = findOrphanBills({
      bills: [
        bill({ id: 'b1', name: 'Unmapped Bill', budget_category_id: null })
      ],
      budgets: [],
      categories: [cat()],
      period
    })
    expect(result).toEqual([])
  })

  it('different month → different set of orphans (only this period\'s budgets count)', () => {
    // A budget exists for May, but we ask about June → bill is orphaned in June.
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', budget_category_id: 'cat-elec' })],
      budgets: [budget({ year: 2026, month: 5, category_id: 'cat-elec' })],
      categories: [cat()],
      period: { year: 2026, month: 6 }
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.bill.id).toBe('b1')
  })

  it('also looks at year boundary correctly', () => {
    // A budget exists for Jan 2026, but we ask about Jan 2025 → bill is orphaned.
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', budget_category_id: 'cat-elec' })],
      budgets: [budget({ year: 2026, month: 1, category_id: 'cat-elec' })],
      categories: [cat()],
      period: { year: 2025, month: 1 }
    })
    expect(result).toHaveLength(1)
  })

  it('sorted by budget_amount desc (biggest first)', () => {
    const result = findOrphanBills({
      bills: [
        bill({ id: 'b-small', budget_category_id: 'cat-water', budget_amount: 40 }),
        bill({ id: 'b-big', budget_category_id: 'cat-tax', budget_amount: 800 }),
        bill({ id: 'b-mid', budget_category_id: 'cat-elec', budget_amount: 120 })
      ],
      budgets: [],
      categories: [
        { id: 'cat-water', name: 'Water' },
        { id: 'cat-tax', name: 'Taxes' },
        { id: 'cat-elec', name: 'Electricity' }
      ],
      period
    })
    expect(result.map(o => o.bill.id)).toEqual(['b-big', 'b-mid', 'b-small'])
  })

  it('skips orphans when the bill\'s category_id is not present in the categories list (defensive)', () => {
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', budget_category_id: 'cat-missing' })],
      budgets: [],
      categories: [cat({ id: 'cat-elec', name: 'Electricity' })],
      period
    })
    expect(result).toEqual([])
  })

  it('ignores budgets whose category_id is null even if year/month match', () => {
    // Legacy budget rows can have category_id = null. Those don\'t cover any
    // bill, so a mapped bill should still be considered orphan.
    const result = findOrphanBills({
      bills: [bill({ id: 'b1', budget_category_id: 'cat-elec' })],
      budgets: [budget({ category_id: null })],
      categories: [cat()],
      period
    })
    expect(result).toHaveLength(1)
    expect(result[0]!.bill.id).toBe('b1')
  })
})
