import { describe, expect, it } from 'vitest'
import { buildProjectInputs } from './buildProjectInputs'
import type { Tables } from '@/lib/supabase/database.types'

type BillRow = Tables<'bills'>
type CategoryRow = Tables<'categories'>

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1', household_id: 'h', name: 'Gas', budget_amount: 100,
    budget_category_id: null, category: 'Utilities', created_at: null,
    due_day: 1, due_month_anchor: null, frequency: 'monthly',
    is_active: true, linked_debt_id: null, notes: null,
    tier: null, seasonal_profile: null,
    ...over
  } as BillRow
}

function cat(over: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'c1', household_id: 'h', name: 'Utilities', type: 'expense',
    is_fixed: true, parent_category: null, tier: null, created_at: null,
    ...over
  } as CategoryRow
}

describe('buildProjectInputs', () => {
  it('resolves a bill tier from its fixed category (essential)', () => {
    const out = buildProjectInputs({
      bills: [bill({ category: 'Utilities' })],
      categories: [cat({ name: 'Utilities', is_fixed: true })]
    })
    expect(out.bills).toHaveLength(1)
    expect(out.bills[0]!.tier).toBe('essential')
    expect(out.bills[0]!.isFixed).toBe(true)
  })

  it('applies the bill-level tier override over the category', () => {
    const out = buildProjectInputs({
      bills: [bill({ tier: 'discretionary', category: 'Utilities' })],
      categories: [cat({ name: 'Utilities', is_fixed: true })]
    })
    expect(out.bills[0]!.tier).toBe('discretionary')
  })

  it('a debt-linked bill is essential even when its category is not fixed', () => {
    const out = buildProjectInputs({
      bills: [bill({ name: 'Car', category: 'Transportation', linked_debt_id: 'd1' })],
      categories: [cat({ name: 'Transportation', is_fixed: false })]
    })
    expect(out.bills[0]!.tier).toBe('essential')
  })

  it('skips inactive bills', () => {
    const out = buildProjectInputs({
      bills: [bill({ is_active: false })],
      categories: [cat()]
    })
    expect(out.bills).toHaveLength(0)
  })

  it('parses a seasonal_profile when present', () => {
    const profile = {
      baseline: [180, 170, 140, 90, 60, 45, 40, 40, 55, 90, 130, 175],
      source: 'import', years: 3, computed_at: '2026-06-21', note: ''
    }
    const out = buildProjectInputs({
      bills: [bill({ seasonal_profile: profile })],
      categories: [cat()]
    })
    expect(out.bills[0]!.seasonalProfile?.baseline[0]).toBe(180)
  })

  it('collects discretionary expense categories with no bill', () => {
    const out = buildProjectInputs({
      bills: [],
      categories: [
        cat({ id: 'c-dining', name: 'Dining', is_fixed: false }),   // discretionary
        cat({ id: 'c-rent',   name: 'Housing', is_fixed: true })    // essential → excluded
      ]
    })
    expect(out.discretionaryCategories.map(d => d.name)).toEqual(['Dining'])
  })

  it('excludes a category already covered by a bill from discretionary', () => {
    const out = buildProjectInputs({
      bills: [bill({ name: 'Netflix', category: 'Dining', tier: 'discretionary' })],
      categories: [cat({ id: 'c-dining', name: 'Dining', is_fixed: false })]
    })
    // Dining is billed → not a separate discretionary line.
    expect(out.discretionaryCategories).toHaveLength(0)
  })

  it('ignores non-expense categories', () => {
    const out = buildProjectInputs({
      bills: [],
      categories: [cat({ name: 'Salary', type: 'income', is_fixed: false })]
    })
    expect(out.discretionaryCategories).toHaveLength(0)
  })
})
