import { describe, it, expect } from 'vitest'
import { suggestCategories, type SuggestInput } from './autoCategorize'

const CATEGORIES = [
  { id: 'cat-food', name: 'Food & Dining' },
  { id: 'cat-grocery', name: 'Groceries' },
  { id: 'cat-transport', name: 'Transportation' },
  { id: 'cat-subs', name: 'Entertainment & Subscriptions' },
  { id: 'cat-shopping', name: 'Shopping' },
  { id: 'cat-utilities', name: 'Utilities' },
  { id: 'cat-health', name: 'Health' },
  { id: 'cat-travel', name: 'Travel' },
  { id: 'cat-custom', name: 'Coffee Habit' },
]

function makeInput(overrides: Partial<SuggestInput> = {}): SuggestInput {
  return {
    uncategorizedTxs: [],
    categorizedTxs: [],
    billMatchRules: [],
    categories: CATEGORIES,
    ...overrides,
  }
}

describe('suggestCategories', () => {
  it('returns empty array for empty uncategorized input', () => {
    expect(suggestCategories(makeInput())).toEqual([])
  })

  it('returns empty array when all inputs are empty', () => {
    expect(
      suggestCategories({
        uncategorizedTxs: [],
        categorizedTxs: [],
        billMatchRules: [],
        categories: [],
      })
    ).toEqual([])
  })

  it('groups multiple txs from the same merchant into a single group', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: 'STARBUCKS #1234' },
          { id: 't2', description: 'STARBUCKS #5678' },
          { id: 't3', description: 'STARBUCKS' },
        ],
      })
    )

    expect(out).toHaveLength(1)
    expect(out[0]!.merchant).toBe('STARBUCKS')
    expect(out[0]!.txIds).toEqual(['t1', 't2', 't3'])
  })

  it('dictionary match: dictionary signal triggers when no rule or learned data exists', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #1234 NEW YORK NY' }],
      })
    )

    expect(out[0]).toMatchObject({
      confidence: 'dictionary',
      suggestedCategoryName: 'Food & Dining',
      suggestedCategoryId: 'cat-food',
    })
  })

  it('dictionary match: substring inside longer description (Starbucks)', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'POS PURCHASE STARBUCKS #1234 NEW YORK NY' }],
      })
    )

    expect(out[0]!.confidence).toBe('dictionary')
    expect(out[0]!.suggestedCategoryName).toBe('Food & Dining')
  })

  it('rule match: rule.name_keyword substring match wins as HIGH confidence', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'CHASE BILL PAY PSEG 6789' }],
        billMatchRules: [{ name_keyword: 'pseg', category: 'Utilities' }],
      })
    )

    expect(out[0]).toMatchObject({
      confidence: 'rule',
      suggestedCategoryName: 'Utilities',
      suggestedCategoryId: 'cat-utilities',
    })
  })

  it('rule match: rule wins even when dictionary would also match', () => {
    // Dictionary would map STARBUCKS -> Food & Dining, but the rule
    // matching "starbucks" maps it to a custom category instead.
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #1234 NEW YORK NY' }],
        billMatchRules: [{ name_keyword: 'starbucks', category: 'Coffee Habit' }],
      })
    )

    expect(out[0]!.confidence).toBe('rule')
    expect(out[0]!.suggestedCategoryName).toBe('Coffee Habit')
    expect(out[0]!.suggestedCategoryId).toBe('cat-custom')
  })

  it('rule with missing keyword is ignored', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #1234' }],
        billMatchRules: [{ name_keyword: null, category: 'Coffee Habit' }],
      })
    )
    // Falls through to dictionary
    expect(out[0]!.confidence).toBe('dictionary')
    expect(out[0]!.suggestedCategoryName).toBe('Food & Dining')
  })

  it('rule with missing category is ignored', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #1234' }],
        billMatchRules: [{ name_keyword: 'starbucks', category: null }],
      })
    )
    // Falls through to dictionary
    expect(out[0]!.confidence).toBe('dictionary')
  })

  it('learned signal: most common category among history wins as MEDIUM confidence', () => {
    const out = suggestCategories(
      makeInput({
        // No dictionary entry for "WAWA"
        uncategorizedTxs: [{ id: 't1', description: 'WAWA STORE 4567' }],
        categorizedTxs: [
          { description: 'WAWA STORE 1111', category: 'Food & Dining' },
          { description: 'WAWA STORE 2222', category: 'Food & Dining' },
          { description: 'WAWA STORE 3333', category: 'Groceries' },
        ],
      })
    )

    expect(out[0]).toMatchObject({
      confidence: 'learned',
      suggestedCategoryName: 'Food & Dining',
      suggestedCategoryId: 'cat-food',
    })
  })

  it('learned signal: ties resolve to first-seen category', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'WAWA STORE 4567' }],
        categorizedTxs: [
          { description: 'WAWA STORE 1111', category: 'Groceries' },
          { description: 'WAWA STORE 2222', category: 'Food & Dining' },
        ],
      })
    )

    expect(out[0]!.confidence).toBe('learned')
    expect(out[0]!.suggestedCategoryName).toBe('Groceries')
  })

  it('learned beats dictionary even when dictionary would match', () => {
    // STARBUCKS dictionary entry → Food & Dining, but user has a
    // history of categorizing STARBUCKS as "Coffee Habit". Learned wins.
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #5555' }],
        categorizedTxs: [
          { description: 'STARBUCKS #1111', category: 'Coffee Habit' },
          { description: 'STARBUCKS #2222', category: 'Coffee Habit' },
        ],
      })
    )

    expect(out[0]!.confidence).toBe('learned')
    expect(out[0]!.suggestedCategoryName).toBe('Coffee Habit')
    expect(out[0]!.suggestedCategoryId).toBe('cat-custom')
  })

  it('rule beats learned (priority order)', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #5555' }],
        categorizedTxs: [
          { description: 'STARBUCKS #1111', category: 'Coffee Habit' },
        ],
        billMatchRules: [{ name_keyword: 'starbucks', category: 'Food & Dining' }],
      })
    )

    expect(out[0]!.confidence).toBe('rule')
    expect(out[0]!.suggestedCategoryName).toBe('Food & Dining')
  })

  it('learned signal: ignores history rows with empty category', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'WAWA STORE 4567' }],
        categorizedTxs: [
          { description: 'WAWA STORE 1111', category: null },
          { description: 'WAWA STORE 2222', category: '   ' },
        ],
      })
    )
    expect(out[0]!.confidence).toBe('none')
  })

  it('confidence none when no signal matches', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'BIG MYSTERY VENDOR 1234' }],
      })
    )

    expect(out[0]).toMatchObject({
      confidence: 'none',
      suggestedCategoryId: null,
      suggestedCategoryName: null,
    })
  })

  it('suggestion is null (none) when matched category does not exist in categories list', () => {
    const slimCategories = [{ id: 'cat-shopping', name: 'Shopping' }]
    const out = suggestCategories({
      uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #1234' }],
      categorizedTxs: [],
      billMatchRules: [],
      categories: slimCategories,
    })

    // Dictionary would suggest "Food & Dining" — not in categories list.
    expect(out[0]).toMatchObject({
      confidence: 'none',
      suggestedCategoryId: null,
      suggestedCategoryName: null,
    })
  })

  it('rule suggestion dropped when its category does not exist in categories list', () => {
    const slimCategories = [{ id: 'cat-shopping', name: 'Shopping' }]
    const out = suggestCategories({
      uncategorizedTxs: [{ id: 't1', description: 'SOMETHING' }],
      categorizedTxs: [],
      billMatchRules: [{ name_keyword: 'something', category: 'Nonexistent Category' }],
      categories: slimCategories,
    })

    expect(out[0]!.confidence).toBe('none')
    expect(out[0]!.suggestedCategoryId).toBeNull()
  })

  it('category name resolution is case-insensitive', () => {
    const out = suggestCategories({
      uncategorizedTxs: [{ id: 't1', description: 'STARBUCKS #1234' }],
      categorizedTxs: [],
      billMatchRules: [],
      categories: [{ id: 'cat-food-lower', name: 'food & dining' }],
    })

    expect(out[0]!.confidence).toBe('dictionary')
    expect(out[0]!.suggestedCategoryId).toBe('cat-food-lower')
  })

  it('sort: bigger groups come first', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: 'AMAZON.COM #1234' },
          { id: 't2', description: 'STARBUCKS #1111' },
          { id: 't3', description: 'STARBUCKS #2222' },
          { id: 't4', description: 'STARBUCKS #3333' },
        ],
      })
    )

    expect(out.map(g => g.merchant)).toEqual(['STARBUCKS', 'AMAZON.COM'])
    expect(out[0]!.txIds).toHaveLength(3)
    expect(out[1]!.txIds).toHaveLength(1)
  })

  it('sort: ties broken alphabetically', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: 'WALMART STORE #1234' },
          { id: 't2', description: 'AMAZON.COM #1234' },
          { id: 't3', description: 'TARGET #1234' },
        ],
      })
    )

    expect(out.map(g => g.merchant)).toEqual(['AMAZON.COM', 'TARGET', 'WALMART STORE'])
  })

  it('same description repeated creates one group with correct tx count', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: 'NETFLIX.COM' },
          { id: 't2', description: 'NETFLIX.COM' },
          { id: 't3', description: 'NETFLIX.COM' },
        ],
      })
    )

    expect(out).toHaveLength(1)
    expect(out[0]!.txIds).toEqual(['t1', 't2', 't3'])
    expect(out[0]!.sampleDescriptions).toEqual(['NETFLIX.COM'])
    expect(out[0]!.confidence).toBe('dictionary')
    expect(out[0]!.suggestedCategoryName).toBe('Entertainment & Subscriptions')
  })

  it('dictionary entries trigger for common patterns across categories', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: 'SHELL OIL 1234' },
          { id: 't2', description: 'NETFLIX.COM SUBSCRIPTION' },
          { id: 't3', description: 'CVS PHARMACY' },
          { id: 't4', description: 'AIRBNB * RESERVATION' },
          { id: 't5', description: 'WHOLE FOODS MARKET' },
        ],
      })
    )

    const byMerchant = new Map(out.map(g => [g.merchant, g]))
    expect(byMerchant.get('SHELL OIL')?.suggestedCategoryName).toBe('Transportation')
    expect(byMerchant.get('NETFLIX.COM SUBSCRIPTION')?.suggestedCategoryName).toBe(
      'Entertainment & Subscriptions'
    )
    expect(byMerchant.get('CVS PHARMACY')?.suggestedCategoryName).toBe('Health')
    expect(byMerchant.get('AIRBNB * RESERVATION')?.suggestedCategoryName).toBe('Travel')
    expect(byMerchant.get('WHOLE FOODS MARKET')?.suggestedCategoryName).toBe('Groceries')
  })

  it('returns sample descriptions deduped, capped at 3, first-seen order', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: 'STARBUCKS #1111' },
          { id: 't2', description: 'STARBUCKS #2222' },
          { id: 't3', description: 'STARBUCKS #1111' }, // dup of #1
          { id: 't4', description: 'STARBUCKS #3333' },
          { id: 't5', description: 'STARBUCKS #4444' }, // would be 4th unique
        ],
      })
    )

    expect(out[0]!.sampleDescriptions).toEqual([
      'STARBUCKS #1111',
      'STARBUCKS #2222',
      'STARBUCKS #3333',
    ])
    expect(out[0]!.txIds).toHaveLength(5)
  })

  it('descriptions normalizing to empty merchant are skipped', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [
          { id: 't1', description: '   ' },
          { id: 't2', description: 'STARBUCKS #1234' },
        ],
      })
    )

    expect(out).toHaveLength(1)
    expect(out[0]!.merchant).toBe('STARBUCKS')
    expect(out[0]!.txIds).toEqual(['t2'])
  })

  it('rule keyword matching is case-insensitive', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'pseg autopay 555' }],
        billMatchRules: [{ name_keyword: 'PSEG', category: 'Utilities' }],
      })
    )

    expect(out[0]!.confidence).toBe('rule')
    expect(out[0]!.suggestedCategoryName).toBe('Utilities')
  })

  it('first-matching rule wins when multiple rules could apply', () => {
    const out = suggestCategories(
      makeInput({
        uncategorizedTxs: [{ id: 't1', description: 'BILLPAY VERIZON WIRELESS' }],
        billMatchRules: [
          { name_keyword: 'verizon', category: 'Utilities' },
          { name_keyword: 'billpay', category: 'Shopping' }, // also matches, but rule 1 wins
        ],
      })
    )

    expect(out[0]!.confidence).toBe('rule')
    expect(out[0]!.suggestedCategoryName).toBe('Utilities')
  })

  describe('bill signal (Phase 3I T2a)', () => {
    it('bill-mapped category beats rule.category as HIGH+ priority', () => {
      // Rule says "Utilities", but the linked bill is mapped to "Housing"
      // (the real budget bucket). Bill mapping wins.
      const out = suggestCategories(
        makeInput({
          uncategorizedTxs: [{ id: 't1', description: 'CHASE BILL PAY PSEG 6789' }],
          billMatchRules: [
            { bill_id: 'bill-electric', name_keyword: 'pseg', category: 'Utilities' },
          ],
          bills: [{ id: 'bill-electric', budget_category_id: 'cat-housing' }],
          categories: [
            ...CATEGORIES,
            { id: 'cat-housing', name: 'Housing' },
          ],
        })
      )

      expect(out[0]).toMatchObject({
        confidence: 'bill',
        suggestedCategoryName: 'Housing',
        suggestedCategoryId: 'cat-housing',
      })
    })

    it('falls back to rule.category when bill has no budget_category_id', () => {
      const out = suggestCategories(
        makeInput({
          uncategorizedTxs: [{ id: 't1', description: 'CHASE BILL PAY PSEG 6789' }],
          billMatchRules: [
            { bill_id: 'bill-electric', name_keyword: 'pseg', category: 'Utilities' },
          ],
          bills: [{ id: 'bill-electric', budget_category_id: null }],
        })
      )

      expect(out[0]!.confidence).toBe('rule')
      expect(out[0]!.suggestedCategoryName).toBe('Utilities')
    })

    it('falls back to rule.category when rule has no bill_id', () => {
      const out = suggestCategories(
        makeInput({
          uncategorizedTxs: [{ id: 't1', description: 'CHASE BILL PAY PSEG 6789' }],
          billMatchRules: [
            // No bill_id at all (legacy BILL_TX_MAP-style rule).
            { name_keyword: 'pseg', category: 'Utilities' },
          ],
          bills: [{ id: 'bill-electric', budget_category_id: 'cat-housing' }],
          categories: [
            ...CATEGORIES,
            { id: 'cat-housing', name: 'Housing' },
          ],
        })
      )

      expect(out[0]!.confidence).toBe('rule')
      expect(out[0]!.suggestedCategoryName).toBe('Utilities')
    })

    it('picks the first matching rule whose linked bill has a mapping', () => {
      // Two rules match the same description. First links to an unmapped
      // bill (no budget_category_id); second links to a mapped bill. The
      // 'bill' loop runs first across ALL rules and picks the first whose
      // bill is mapped — which is rule 2.
      const out = suggestCategories(
        makeInput({
          uncategorizedTxs: [{ id: 't1', description: 'PAYMENT BIGCO XYZ' }],
          billMatchRules: [
            { bill_id: 'bill-unmapped', name_keyword: 'bigco', category: 'Shopping' },
            { bill_id: 'bill-mapped', name_keyword: 'payment', category: 'Financial' },
          ],
          bills: [
            { id: 'bill-unmapped', budget_category_id: null },
            { id: 'bill-mapped', budget_category_id: 'cat-housing' },
          ],
          categories: [
            ...CATEGORIES,
            { id: 'cat-housing', name: 'Housing' },
          ],
        })
      )

      expect(out[0]!.confidence).toBe('bill')
      expect(out[0]!.suggestedCategoryName).toBe('Housing')
    })

    it('falls through when bill.budget_category_id does not resolve to a real category', () => {
      // Defensive: bill points to a category id that no longer exists in
      // the categories list. The 'bill' signal must NOT propose a phantom
      // category — fall through to the next tier (rule.category).
      const out = suggestCategories(
        makeInput({
          uncategorizedTxs: [{ id: 't1', description: 'CHASE BILL PAY PSEG 6789' }],
          billMatchRules: [
            { bill_id: 'bill-electric', name_keyword: 'pseg', category: 'Utilities' },
          ],
          bills: [{ id: 'bill-electric', budget_category_id: 'ghost-cat-id' }],
        })
      )

      expect(out[0]!.confidence).toBe('rule')
      expect(out[0]!.suggestedCategoryName).toBe('Utilities')
    })
  })
})
