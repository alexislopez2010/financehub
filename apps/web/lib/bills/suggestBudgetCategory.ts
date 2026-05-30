/**
 * Best-guess mapping from a bill's free-text `category` (e.g. "Mortgage/Rent",
 * "Phone") or `name` to a real budget category id. Used to seed the
 * bulk-mapping UI so the user only has to confirm/override.
 *
 * Strategy: case-insensitive regex match against a built-in dictionary of
 * (pattern → categoryName) pairs, where the result is the categoryId looked
 * up (case-insensitive) in the categories list. Match the bill's `category`
 * text first; if no pattern matches, fall back to the bill's `name`.
 *
 * Returns null if no confident match. Never makes wild guesses — better to
 * leave the row null than mislead the user during bulk confirmation.
 *
 * Pure — no React, no Supabase imports.
 */

import type { Tables } from '@/lib/supabase/database.types'

type BillRow = Tables<'bills'>
type CategoryRow = Tables<'categories'>

interface Pattern {
  readonly regex: RegExp
  readonly categoryName: string
}

/**
 * Built-in pattern dictionary, aligned with the seed categories shipped in
 * `lib/ledger/autoCategorize.ts`. First pattern to match wins.
 */
const PATTERNS: ReadonlyArray<Pattern> = [
  { regex: /mortgage|rent|housing/i,                              categoryName: 'Housing' },
  { regex: /insurance/i,                                          categoryName: 'Housing' },
  { regex: /electric|water|sewer|utilit/i,                        categoryName: 'Housing' },
  { regex: /phone|internet|comcast|verizon|xfinity/i,             categoryName: 'Housing' },
  { regex: /car payment|auto loan/i,                              categoryName: 'Transportation' },
  { regex: /parking|toll|transit/i,                               categoryName: 'Transportation' },
  { regex: /gas (?!service|company|utilit)/i,                     categoryName: 'Transportation' },
  { regex: /subscription|streaming|netflix|spotify|hulu|disney/i, categoryName: 'Entertainment & Subscriptions' },
  { regex: /software|ai service|technology/i,                     categoryName: 'Software & Apps' },
  { regex: /movie|event/i,                                        categoryName: 'Entertainment & Subscriptions' },
  { regex: /book|media/i,                                         categoryName: 'Entertainment & Subscriptions' },
  { regex: /gym|fitness/i,                                        categoryName: 'Health & Wellness' },
  { regex: /school|tuition/i,                                     categoryName: 'Kids' },
  { regex: /tithe|offering|donat|charity/i,                       categoryName: 'Giving' },
  { regex: /tax/i,                                                categoryName: 'Taxes' },
  { regex: /debt payment|loan/i,                                  categoryName: 'Financial' },
  { regex: /dog food|pet|supplies/i,                              categoryName: 'Personal & Family' },
  { regex: /gift/i,                                               categoryName: 'Family & Gifts' },
]

/**
 * Suggest a budget category id for a bill, using the free-text fields the
 * user already provided. Returns null when no pattern matches OR when the
 * matched pattern's category name doesn't resolve to a real category in
 * the provided list.
 */
export function suggestBudgetCategoryId(
  bill: Pick<BillRow, 'name' | 'category'>,
  categories: ReadonlyArray<Pick<CategoryRow, 'id' | 'name'>>
): string | null {
  // Build a lowercase name → id index. Skip blanks; first occurrence wins.
  const categoryIdByName = new Map<string, string>()
  for (const c of categories) {
    const key = c.name.trim().toLowerCase()
    if (!key) continue
    if (!categoryIdByName.has(key)) categoryIdByName.set(key, c.id)
  }

  const haystacks: ReadonlyArray<string> = [bill.category ?? '', bill.name ?? '']
  for (const haystack of haystacks) {
    const text = haystack.trim()
    if (!text) continue
    for (const pattern of PATTERNS) {
      if (!pattern.regex.test(text)) continue
      const id = categoryIdByName.get(pattern.categoryName.trim().toLowerCase())
      if (!id) return null
      return id
    }
  }

  return null
}
