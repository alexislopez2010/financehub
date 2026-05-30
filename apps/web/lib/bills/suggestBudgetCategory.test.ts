import { describe, it, expect } from 'vitest'
import { suggestBudgetCategoryId } from './suggestBudgetCategory'

const CATEGORIES = [
  { id: 'cat-housing', name: 'Housing' },
  { id: 'cat-transport', name: 'Transportation' },
  { id: 'cat-subs', name: 'Entertainment & Subscriptions' },
  { id: 'cat-software', name: 'Software & Apps' },
  { id: 'cat-health', name: 'Health & Wellness' },
  { id: 'cat-kids', name: 'Kids' },
  { id: 'cat-giving', name: 'Giving' },
  { id: 'cat-taxes', name: 'Taxes' },
  { id: 'cat-financial', name: 'Financial' },
  { id: 'cat-personal', name: 'Personal & Family' },
  { id: 'cat-gifts', name: 'Family & Gifts' },
]

describe('suggestBudgetCategoryId', () => {
  it('matches "Mortgage/Rent" → Housing', () => {
    const id = suggestBudgetCategoryId({ name: 'Rent', category: 'Mortgage/Rent' }, CATEGORIES)
    expect(id).toBe('cat-housing')
  })

  it('matches "Phone" → Housing', () => {
    const id = suggestBudgetCategoryId({ name: 'Verizon', category: 'Phone' }, CATEGORIES)
    expect(id).toBe('cat-housing')
  })

  it('matches "Car Payment" → Transportation', () => {
    const id = suggestBudgetCategoryId({ name: 'Toyota Loan', category: 'Car Payment' }, CATEGORIES)
    expect(id).toBe('cat-transport')
  })

  it('matches "Subscriptions" → Entertainment & Subscriptions', () => {
    const id = suggestBudgetCategoryId({ name: 'Netflix', category: 'Subscriptions' }, CATEGORIES)
    expect(id).toBe('cat-subs')
  })

  it('matches "Tithes/Offering" → Giving', () => {
    const id = suggestBudgetCategoryId({ name: 'Church', category: 'Tithes/Offering' }, CATEGORIES)
    expect(id).toBe('cat-giving')
  })

  it('returns null for unknown "Foo/Bar"', () => {
    const id = suggestBudgetCategoryId({ name: 'Weird Bill', category: 'Foo/Bar' }, CATEGORIES)
    expect(id).toBeNull()
  })

  it('matches against name when category is null', () => {
    const id = suggestBudgetCategoryId({ name: 'Mortgage Payment', category: null }, CATEGORIES)
    expect(id).toBe('cat-housing')
  })

  it('is case-insensitive against category', () => {
    const id = suggestBudgetCategoryId({ name: 'X', category: 'MORTGAGE/RENT' }, CATEGORIES)
    expect(id).toBe('cat-housing')
  })

  it('is case-insensitive against name fallback', () => {
    const id = suggestBudgetCategoryId({ name: 'NETFLIX SUBSCRIPTION', category: null }, CATEGORIES)
    expect(id).toBe('cat-subs')
  })

  it('returns null when matched pattern category does not exist in categories list', () => {
    // "Gym/Fitness" maps to "Health & Wellness", but we omit it from the list.
    const truncatedCategories = CATEGORIES.filter(c => c.name !== 'Health & Wellness')
    const id = suggestBudgetCategoryId({ name: 'X', category: 'Gym/Fitness' }, truncatedCategories)
    expect(id).toBeNull()
  })

  it('matches category before falling back to name', () => {
    // category "Mortgage" matches Housing first; name would also match
    // Transportation via "auto loan" but category is consulted first.
    const id = suggestBudgetCategoryId(
      { name: 'Auto Loan', category: 'Mortgage' },
      CATEGORIES
    )
    expect(id).toBe('cat-housing')
  })

  it('first pattern in dictionary wins when multiple could match', () => {
    // "rent insurance" — both "rent" (Housing) and "insurance" (Housing)
    // are present; PATTERNS order means "mortgage|rent|housing" fires first.
    // Both map to Housing here so check name lookup is deterministic.
    const id = suggestBudgetCategoryId(
      { name: 'X', category: 'rent insurance' },
      CATEGORIES
    )
    expect(id).toBe('cat-housing')
  })

  it('returns null for empty category + empty name', () => {
    const id = suggestBudgetCategoryId({ name: '', category: null }, CATEGORIES)
    expect(id).toBeNull()
  })

  it('matches "gym" → Health & Wellness via name', () => {
    const id = suggestBudgetCategoryId({ name: 'Planet Fitness Gym', category: null }, CATEGORIES)
    expect(id).toBe('cat-health')
  })
})
