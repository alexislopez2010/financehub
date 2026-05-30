/**
 * Pure suggestion engine for auto-categorizing uncategorized transactions.
 *
 * Groups uncategorized rows by normalized merchant and proposes a single
 * category per group from four ranked signal sources:
 *
 *   1. Bill-mapped category   (confidence='bill')       HIGH
 *      A bill_match_rule whose linked bill has a `budget_category_id`
 *      mapped to a real category. Bridges bill payments into the right
 *      budget bucket regardless of the rule's text `category` column.
 *   2. `bill_match_rules`     (confidence='rule')       HIGH
 *      The rule's own text `category` column (legacy / unmapped bills).
 *   3. Learned from history   (confidence='learned')    MEDIUM
 *   4. Built-in dictionary    (confidence='dictionary') MEDIUM
 *   else                        confidence='none'        — no suggestion
 *
 * First signal source to fire wins; later sources are not consulted.
 *
 * Already-categorized rows are NEVER targets of this engine — they are
 * only consumed as the "learned" signal source. The caller passes the
 * uncategorized rows to operate on and the categorized rows as history.
 *
 * Suggested category names are resolved against the categories list
 * (case-insensitive). Suggestions whose name doesn't resolve to a real
 * category are dropped (we never propose a phantom category).
 *
 * Pure — no React, no Supabase imports. Reuses `normalizeMerchant`
 * from `lib/briefing/topMerchants` to stay aligned with the merchant
 * grouping used elsewhere in the app.
 */

import { normalizeMerchant } from '@/lib/briefing/topMerchants'

export interface MerchantGroup {
  /** Normalized merchant key. */
  merchant: string
  /** Transactions in this group (uncategorized only). */
  txIds: ReadonlyArray<string>
  /** Sample of descriptions for display (deduped, in first-seen order). */
  sampleDescriptions: ReadonlyArray<string>
  /** Suggested category id (resolved from name); null if no suggestion. */
  suggestedCategoryId: string | null
  /** Display name for the suggestion. */
  suggestedCategoryName: string | null
  /** Where the suggestion came from. */
  confidence: 'bill' | 'rule' | 'learned' | 'dictionary' | 'none'
}

export interface SuggestInput {
  uncategorizedTxs: ReadonlyArray<{
    id: string
    description: string
  }>
  /**
   * Already-categorized txs in the user's history. Used for the 'learned'
   * signal — same normalized merchant + assigned category → suggestion.
   */
  categorizedTxs: ReadonlyArray<{
    description: string
    category: string | null
  }>
  billMatchRules: ReadonlyArray<{
    /** Optional FK to a bill; enables the 'bill' signal when set. */
    bill_id?: string | null
    name_keyword: string | null
    category: string | null
  }>
  /**
   * Bills with their mapped budget category. Used for the 'bill' signal:
   * when a rule's `bill_id` resolves to a bill whose `budget_category_id`
   * resolves to a real category, that category becomes the suggestion.
   * Defaults to [] when omitted.
   */
  bills?: ReadonlyArray<{
    id: string
    budget_category_id: string | null
  }>
  categories: ReadonlyArray<{ id: string; name: string }>
}

interface DictionaryEntry {
  pattern: string
  categoryName: string
}

/**
 * Built-in merchant patterns. Substring matches (case-insensitive) against
 * the FULL description, not just the normalized merchant — so patterns like
 * "APPLE.COM" catch even if normalization would otherwise strip context.
 */
const BUILTIN_DICTIONARY: ReadonlyArray<DictionaryEntry> = [
  // Food & Dining
  { pattern: 'STARBUCKS', categoryName: 'Food & Dining' },
  { pattern: 'DUNKIN', categoryName: 'Food & Dining' },
  { pattern: 'MCDONALDS', categoryName: 'Food & Dining' },
  { pattern: 'CHIPOTLE', categoryName: 'Food & Dining' },
  { pattern: 'CHILI', categoryName: 'Food & Dining' },
  { pattern: 'RESTAURANT', categoryName: 'Food & Dining' },
  { pattern: 'GRUBHUB', categoryName: 'Food & Dining' },
  { pattern: 'DOORDASH', categoryName: 'Food & Dining' },
  { pattern: 'UBER EATS', categoryName: 'Food & Dining' },
  // Groceries
  { pattern: 'COSTCO WHSE', categoryName: 'Groceries' },
  { pattern: 'ALDI', categoryName: 'Groceries' },
  { pattern: 'WHOLE FOODS', categoryName: 'Groceries' },
  { pattern: 'TRADER JOE', categoryName: 'Groceries' },
  { pattern: 'SHOPRITE', categoryName: 'Groceries' },
  { pattern: 'WEGMANS', categoryName: 'Groceries' },
  { pattern: 'STOP & SHOP', categoryName: 'Groceries' },
  // Transportation / Gas
  { pattern: 'COSTCO GAS', categoryName: 'Transportation' },
  { pattern: 'SHELL', categoryName: 'Transportation' },
  { pattern: 'EXXON', categoryName: 'Transportation' },
  { pattern: 'BP ', categoryName: 'Transportation' },
  { pattern: 'CHEVRON', categoryName: 'Transportation' },
  { pattern: 'UBER', categoryName: 'Transportation' },
  { pattern: 'LYFT', categoryName: 'Transportation' },
  { pattern: 'PATH ', categoryName: 'Transportation' },
  { pattern: 'NJ TRANSIT', categoryName: 'Transportation' },
  // Subscriptions / Entertainment
  { pattern: 'NETFLIX', categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'SPOTIFY', categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'YOUTUBE', categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'APPLE.COM', categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'HULU', categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'DISNEY', categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'AMAZON PRIME', categoryName: 'Entertainment & Subscriptions' },
  // Shopping (generic)
  { pattern: 'AMAZON', categoryName: 'Shopping' },
  { pattern: 'TARGET', categoryName: 'Shopping' },
  { pattern: 'WALMART', categoryName: 'Shopping' },
  { pattern: 'TEMU', categoryName: 'Shopping' },
  { pattern: 'EBAY', categoryName: 'Shopping' },
  { pattern: 'BEST BUY', categoryName: 'Shopping' },
  // Travel
  { pattern: 'AIRBNB', categoryName: 'Travel' },
  { pattern: 'UNITED AIRLINES', categoryName: 'Travel' },
  { pattern: 'DELTA AIR', categoryName: 'Travel' },
  { pattern: 'AMERICAN AIR', categoryName: 'Travel' },
  { pattern: 'PRIORITY PASS', categoryName: 'Travel' },
  { pattern: 'HOTEL', categoryName: 'Travel' },
  // Utilities / Housing
  { pattern: 'PSE&G', categoryName: 'Utilities' },
  { pattern: 'VERIZON', categoryName: 'Utilities' },
  { pattern: 'COMCAST', categoryName: 'Utilities' },
  { pattern: 'XFINITY', categoryName: 'Utilities' },
  // Health
  { pattern: 'CVS', categoryName: 'Health' },
  { pattern: 'WALGREENS', categoryName: 'Health' },
  { pattern: 'PHARMACY', categoryName: 'Health' },
]

/** Max sample descriptions to surface per group. */
const MAX_SAMPLES = 3

interface GroupedTx {
  merchant: string
  txIds: string[]
  descriptions: string[]
}

/**
 * Computes a category suggestion per merchant group from three ranked
 * signal sources. See module doc for full semantics.
 */
export function suggestCategories(input: SuggestInput): ReadonlyArray<MerchantGroup> {
  const { uncategorizedTxs, categorizedTxs, billMatchRules, categories } = input
  const bills = input.bills ?? []

  // 1. Group uncategorized txs by normalized merchant.
  const groupsByMerchant = new Map<string, GroupedTx>()
  for (const tx of uncategorizedTxs) {
    const merchant = normalizeMerchant(tx.description)
    if (!merchant) continue
    const cur = groupsByMerchant.get(merchant)
    if (cur) {
      cur.txIds.push(tx.id)
      cur.descriptions.push(tx.description)
    } else {
      groupsByMerchant.set(merchant, {
        merchant,
        txIds: [tx.id],
        descriptions: [tx.description],
      })
    }
  }

  // 2. Pre-compute learned signal index: normalized merchant -> ordered
  //    list of category names (in input order, with duplicates preserved
  //    so the most common can be picked).
  const learnedByMerchant = new Map<string, string[]>()
  for (const tx of categorizedTxs) {
    const cat = (tx.category ?? '').trim()
    if (!cat) continue
    const merchant = normalizeMerchant(tx.description)
    if (!merchant) continue
    const cur = learnedByMerchant.get(merchant)
    if (cur) cur.push(cat)
    else learnedByMerchant.set(merchant, [cat])
  }

  // 3. Build a lowercase index for category id resolution + the inverse
  //    id→name map (used for the 'bill' signal to look up the mapped
  //    category name from a bill's budget_category_id).
  const categoryIdByName = new Map<string, string>()
  const categoryNameById = new Map<string, string>()
  for (const c of categories) {
    const key = c.name.trim().toLowerCase()
    if (!key) continue
    if (!categoryIdByName.has(key)) categoryIdByName.set(key, c.id)
    if (!categoryNameById.has(c.id)) categoryNameById.set(c.id, c.name)
  }

  // 3a. Bill index: id → budget_category_id (skip bills with no mapping).
  const billBudgetCategoryById = new Map<string, string>()
  for (const b of bills) {
    if (b.budget_category_id) billBudgetCategoryById.set(b.id, b.budget_category_id)
  }

  // 4. For each group, compute its suggestion.
  const out: MerchantGroup[] = []
  for (const group of groupsByMerchant.values()) {
    const { name, confidence } = computeSuggestion({
      group,
      billMatchRules,
      learnedByMerchant,
      billBudgetCategoryById,
      categoryNameById,
    })

    const id = name ? categoryIdByName.get(name.trim().toLowerCase()) ?? null : null

    // If the suggestion name doesn't resolve to a real category, drop it
    // back to 'none' rather than proposing a phantom category.
    const resolved: { name: string | null; confidence: MerchantGroup['confidence'] } =
      name && id ? { name, confidence } : { name: null, confidence: 'none' }

    out.push({
      merchant: group.merchant,
      txIds: group.txIds,
      sampleDescriptions: dedupeSamples(group.descriptions, MAX_SAMPLES),
      suggestedCategoryId: id,
      suggestedCategoryName: resolved.name,
      confidence: resolved.confidence,
    })
  }

  // 5. Sort: tx count desc, alphabetical tie-break.
  out.sort((a, b) => {
    if (b.txIds.length !== a.txIds.length) return b.txIds.length - a.txIds.length
    return a.merchant.localeCompare(b.merchant)
  })

  return out
}

interface ComputeSuggestionInput {
  group: GroupedTx
  billMatchRules: SuggestInput['billMatchRules']
  learnedByMerchant: ReadonlyMap<string, ReadonlyArray<string>>
  /** Bill id → budget_category_id (only bills with a mapping). */
  billBudgetCategoryById: ReadonlyMap<string, string>
  /** Category id → display name (for 'bill' signal resolution). */
  categoryNameById: ReadonlyMap<string, string>
}

interface ComputedSuggestion {
  name: string | null
  confidence: MerchantGroup['confidence']
}

function computeSuggestion(input: ComputeSuggestionInput): ComputedSuggestion {
  const {
    group,
    billMatchRules,
    learnedByMerchant,
    billBudgetCategoryById,
    categoryNameById,
  } = input
  const lowerDescriptions = group.descriptions.map(d => d.toLowerCase())

  // (1) Bill signal — any rule.name_keyword matches AND that rule links
  //     to a bill with a mapped budget_category_id that resolves to a
  //     real category. Highest priority: ranks ABOVE rule.category.
  for (const rule of billMatchRules) {
    const kw = rule.name_keyword?.trim().toLowerCase()
    if (!kw) continue
    const matches = lowerDescriptions.some(d => d.includes(kw))
    if (!matches) continue
    const billId = rule.bill_id ?? null
    if (!billId) continue
    const mappedCategoryId = billBudgetCategoryById.get(billId)
    if (!mappedCategoryId) continue
    const categoryName = categoryNameById.get(mappedCategoryId)
    if (!categoryName) continue
    return { name: categoryName, confidence: 'bill' }
  }

  // (2) Rule match — any rule.name_keyword found in any description.
  //     Falls through to here when no rule had a bill-mapped category.
  for (const rule of billMatchRules) {
    const kw = rule.name_keyword?.trim().toLowerCase()
    if (!kw) continue
    const matches = lowerDescriptions.some(d => d.includes(kw))
    if (!matches) continue
    const cat = rule.category?.trim()
    if (!cat) continue
    return { name: cat, confidence: 'rule' }
  }

  // (3) Learned — same normalized merchant in categorized history.
  const learned = learnedByMerchant.get(group.merchant)
  if (learned && learned.length > 0) {
    const mostCommon = pickMostCommon(learned)
    if (mostCommon) return { name: mostCommon, confidence: 'learned' }
  }

  // (4) Dictionary — substring of any description matches a pattern.
  for (const entry of BUILTIN_DICTIONARY) {
    const p = entry.pattern.toLowerCase()
    const matches = lowerDescriptions.some(d => d.includes(p))
    if (matches) return { name: entry.categoryName, confidence: 'dictionary' }
  }

  return { name: null, confidence: 'none' }
}

/**
 * Returns the most frequently occurring string in the array. Ties are
 * broken by first-seen order. Returns null on empty input.
 */
function pickMostCommon(values: ReadonlyArray<string>): string | null {
  if (values.length === 0) return null
  const counts = new Map<string, { count: number; firstIndex: number }>()
  values.forEach((v, i) => {
    const cur = counts.get(v)
    if (cur) cur.count += 1
    else counts.set(v, { count: 1, firstIndex: i })
  })
  let best: { value: string; count: number; firstIndex: number } | null = null
  for (const [value, { count, firstIndex }] of counts.entries()) {
    if (!best) {
      best = { value, count, firstIndex }
      continue
    }
    if (count > best.count) {
      best = { value, count, firstIndex }
    } else if (count === best.count && firstIndex < best.firstIndex) {
      best = { value, count, firstIndex }
    }
  }
  return best?.value ?? null
}

/** Returns up to `limit` unique descriptions in first-seen order. */
function dedupeSamples(descriptions: ReadonlyArray<string>, limit: number): ReadonlyArray<string> {
  const seen = new Set<string>()
  const out: string[] = []
  for (const d of descriptions) {
    if (seen.has(d)) continue
    seen.add(d)
    out.push(d)
    if (out.length >= limit) break
  }
  return out
}
