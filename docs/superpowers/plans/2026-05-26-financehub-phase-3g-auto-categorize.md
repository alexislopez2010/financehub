# Phase 3G — Auto-categorize uncategorized transactions

> Subagent-driven; ~2 dispatches.

**Goal:** Add a one-click "Auto-categorize" button on the Ledger that opens a review modal with merchant groups. Each group shows the normalized merchant + tx count + a category suggestion (sourced from bill_match_rules, built-in dictionary, or learned from already-categorized rows). User confirms / overrides / skips per merchant, then Apply bulk-commits. **Only operates on uncategorized rows — already-categorized rows are never touched.**

**Why this UX:** 95% of the user's 978 transactions are uncategorized. Manual per-row classification is grim. Grouping by merchant means ~12 STARBUCKS rows become 1 click. Showing suggestions seeds the right answer most of the time so the user just confirms.

## Architecture

Pure suggestion engine in `lib/ledger/autoCategorize.ts` — three ranked signal sources, deterministic. UI is a Radix Dialog rendering a scrollable group table. Mutations use the existing `useUpdateTransaction` per-row loop (same pattern as the bulk-assign Category we shipped — including writing BOTH `category_id` and `category` text columns).

## Suggestion signal sources (ranked)

| Source | Confidence | How |
|---|---|---|
| `bill_match_rules` | HIGH | Any rule where `name_keyword` (lowercased) is a substring of the tx description (lowercased). First match wins. |
| **Learned from your data** | MEDIUM | Other already-categorized transactions with the same normalized merchant. Use the most common category among them (≥1 example needed). |
| **Built-in dictionary** | MEDIUM | ~50 common merchant patterns hardcoded (`STARBUCKS → Food & Dining`, `SHELL → Transportation`, etc.). Substring match, case-insensitive. |
| (none) | NONE | No suggestion — user picks manually or skips |

Built-in dictionary matches against the FULL description (not just normalized merchant) so patterns like `APPLE.COM BILL` catch even if `APPLE.COM` doesn't survive normalization.

## File structure

```
apps/web/
├── lib/ledger/
│   ├── autoCategorize.ts                NEW — pure suggestion engine + built-in dictionary
│   └── autoCategorize.test.ts
└── components/ledger/
    ├── AutoCategorizeDialog.tsx         NEW — review modal
    ├── AutoCategorizeDialog.test.tsx
    └── Ledger.tsx                       EDIT — add button + dialog wiring
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | `lib/ledger/autoCategorize.ts` pure suggestion engine + built-in merchant dictionary + tests (~20 cases) | `lib/ledger/autoCategorize.*` |
| 2 | `AutoCategorizeDialog` review UI + button on Ledger toolbar + bulk-apply via useUpdateTransaction loop + smoke tests + verify | `components/ledger/AutoCategorizeDialog.*`, `components/ledger/Ledger.tsx` |

## Pure module spec

```ts
export interface MerchantGroup {
  /** Normalized merchant key. */
  merchant: string
  /** Transactions in this group (uncategorized only). */
  txIds: ReadonlyArray<string>
  /** Sample of descriptions for display. */
  sampleDescriptions: ReadonlyArray<string>
  /** Suggested category id (resolved from name); null if no suggestion. */
  suggestedCategoryId: string | null
  /** Display name for the suggestion. */
  suggestedCategoryName: string | null
  /** Where the suggestion came from. */
  confidence: 'rule' | 'learned' | 'dictionary' | 'none'
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
    name_keyword: string | null
    category: string | null
  }>
  categories: ReadonlyArray<{ id: string; name: string }>
}

export function suggestCategories(input: SuggestInput): ReadonlyArray<MerchantGroup>
```

Behavior:
- Normalize merchant via the same `normalizeMerchant` helper used in `topMerchants.ts` (strip trailing transaction IDs, location codes)
- Group uncategorized txs by normalized merchant
- For each group, compute a single suggestion by checking sources in order (rule → learned → dictionary → none) and stopping at the first hit
- Resolve `suggestedCategoryName` → `suggestedCategoryId` via the categories list (case-insensitive name match). If the name doesn't match any category, suggestion is null (don't suggest a category that doesn't exist).
- Sort groups: tx count desc (biggest first); tie-break alphabetical merchant

### Built-in dictionary (initial)

```ts
const BUILTIN_DICTIONARY: ReadonlyArray<{ pattern: string; categoryName: string }> = [
  // Food & Dining
  { pattern: 'STARBUCKS',     categoryName: 'Food & Dining' },
  { pattern: 'DUNKIN',        categoryName: 'Food & Dining' },
  { pattern: 'MCDONALDS',     categoryName: 'Food & Dining' },
  { pattern: 'CHIPOTLE',      categoryName: 'Food & Dining' },
  { pattern: 'CHILI',         categoryName: 'Food & Dining' },
  { pattern: 'RESTAURANT',    categoryName: 'Food & Dining' },
  { pattern: 'GRUBHUB',       categoryName: 'Food & Dining' },
  { pattern: 'DOORDASH',      categoryName: 'Food & Dining' },
  { pattern: 'UBER EATS',     categoryName: 'Food & Dining' },
  // Groceries
  { pattern: 'COSTCO WHSE',   categoryName: 'Groceries' },
  { pattern: 'ALDI',          categoryName: 'Groceries' },
  { pattern: 'WHOLE FOODS',   categoryName: 'Groceries' },
  { pattern: 'TRADER JOE',    categoryName: 'Groceries' },
  { pattern: 'SHOPRITE',      categoryName: 'Groceries' },
  { pattern: 'WEGMANS',       categoryName: 'Groceries' },
  { pattern: 'STOP & SHOP',   categoryName: 'Groceries' },
  // Transportation / Gas
  { pattern: 'COSTCO GAS',    categoryName: 'Transportation' },
  { pattern: 'SHELL',         categoryName: 'Transportation' },
  { pattern: 'EXXON',         categoryName: 'Transportation' },
  { pattern: 'BP ',           categoryName: 'Transportation' },
  { pattern: 'CHEVRON',       categoryName: 'Transportation' },
  { pattern: 'UBER',          categoryName: 'Transportation' },
  { pattern: 'LYFT',          categoryName: 'Transportation' },
  { pattern: 'PATH ',         categoryName: 'Transportation' },
  { pattern: 'NJ TRANSIT',    categoryName: 'Transportation' },
  // Subscriptions / Entertainment
  { pattern: 'NETFLIX',       categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'SPOTIFY',       categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'YOUTUBE',       categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'APPLE.COM',     categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'HULU',          categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'DISNEY',        categoryName: 'Entertainment & Subscriptions' },
  { pattern: 'AMAZON PRIME',  categoryName: 'Entertainment & Subscriptions' },
  // Shopping (generic)
  { pattern: 'AMAZON',        categoryName: 'Shopping' },
  { pattern: 'TARGET',        categoryName: 'Shopping' },
  { pattern: 'WALMART',       categoryName: 'Shopping' },
  { pattern: 'TEMU',          categoryName: 'Shopping' },
  { pattern: 'EBAY',          categoryName: 'Shopping' },
  { pattern: 'BEST BUY',      categoryName: 'Shopping' },
  // Travel
  { pattern: 'AIRBNB',        categoryName: 'Travel' },
  { pattern: 'UNITED AIRLINES', categoryName: 'Travel' },
  { pattern: 'DELTA AIR',     categoryName: 'Travel' },
  { pattern: 'AMERICAN AIR',  categoryName: 'Travel' },
  { pattern: 'PRIORITY PASS', categoryName: 'Travel' },
  { pattern: 'HOTEL',         categoryName: 'Travel' },
  // Utilities / Housing
  { pattern: 'PSE&G',         categoryName: 'Utilities' },
  { pattern: 'VERIZON',       categoryName: 'Utilities' },
  { pattern: 'COMCAST',       categoryName: 'Utilities' },
  { pattern: 'XFINITY',       categoryName: 'Utilities' },
  // Health
  { pattern: 'CVS',           categoryName: 'Health' },
  { pattern: 'WALGREENS',     categoryName: 'Health' },
  { pattern: 'PHARMACY',      categoryName: 'Health' },
]
```

(More patterns can be added later — this is the seed set.)

## UI spec (T2)

### `AutoCategorizeDialog.tsx`

Radix Dialog, full-page-ish modal. Props:
```ts
interface AutoCategorizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}
```

Internal state: fetches uncategorized rows + bill_match_rules + categories + categorizedTxs via existing hooks. Calls `suggestCategories(...)` to derive groups. Holds per-group user choice (selected category id) and per-group skip flag.

Layout:
- **Header**: "Auto-categorize transactions" + close button. Sub-line: "N uncategorized rows across M merchants. Suggestions seeded from your rules + built-in patterns + history. Only rows you keep selected will be updated."
- **Summary tiles** (3-row): groups with rule/learned/dictionary suggestion · groups with no suggestion · skipped
- **Group table**: scrollable list, one row per merchant group:
  - Checkbox (selected = include in apply; default ON if suggestion exists, OFF if confidence='none')
  - Merchant name + small sample descriptions ("STARBUCKS — STARBUCKS #1234 NEW YORK NY, +2 more")
  - Tx count (`12 txs`)
  - Confidence pill (HIGH / MEDIUM / "?")
  - Category select dropdown (pre-selected with suggestion if any, otherwise "(no change)")
- **Footer**:
  - Left: "Will categorize X transactions in Y groups"
  - Right: Cancel · "Apply" primary button (disabled if X = 0)

On Apply:
- For each selected group with a category chosen, run `useUpdateTransaction` per-row for every tx in that group's `txIds`
- Patch: `{ category_id, category: categoryName }` (write both columns — same pattern as bulk-assign Category fix)
- Use `Promise.allSettled` so partial failures don't stop the rest
- Show progress: "Applying 47 of 134…"
- Close on completion + toast/inline summary: "Categorized X transactions"

### Ledger toolbar button

Add "Auto-categorize" button next to "Import":
```tsx
<button
  onClick={() => setAutoCatOpen(true)}
  className="..."
>
  <Sparkles size={14} /> Auto-categorize
</button>
```

Use lucide `Sparkles` or `Wand2` icon. Modest styling like the Import button.

## Tests

### `autoCategorize.test.ts` (~20 tests)
- Empty uncategorized → empty groups
- Single tx with rule match → group of 1 with confidence='rule'
- Multiple txs same merchant → grouped, single suggestion
- Rule beats dictionary (priority order)
- Learned beats dictionary
- Dictionary fallback when no rule or learned
- No match → confidence='none', suggestedCategoryId=null
- Category name doesn't exist in categories list → suggestion is null (defensive)
- Sort: bigger groups first, alphabetical tie-break
- Built-in dictionary entries trigger correctly for common patterns

### `AutoCategorizeDialog.test.tsx` (~5 smoke tests)
- Renders summary tiles + group table when open
- Checkbox toggling per group
- Category override per group
- Apply button disabled when 0 selected
- Apply triggers mutations for selected groups only

## Verify (T2)

```
cd /Users/alexis.lopez/Code/financehub
npm run test --workspace=@financehub/web
npm run lint --workspace=@financehub/web
cd apps/web && npx tsc --noEmit
npm run build --workspace=@financehub/web
```

Expected:
- Vitest: 943 + ~25 new = ~968 passing
- Build green, lint clean, tsc clean
- /ledger route bundle slightly larger (dialog + table)

## Success criteria

- "Auto-categorize" button visible on Ledger
- Click → modal opens with all uncategorized rows grouped by merchant
- Suggestions correct for any of: bill_match_rule match, learned-from-history match, dictionary match
- User can override / skip per group
- Apply only updates UNCATEGORIZED rows — already-categorized rows are NEVER touched (the suggestion engine doesn't even consider them as targets; they're only used as learning signal)
- Progress shown during bulk apply
- Summary shown on completion

## Out of scope

- LLM-based suggestions (Anthropic / OpenAI calls) — deferred
- Editable built-in dictionary in the UI — defer (code-only for now; user can ping me to extend)
- Saving group decisions as new bill_match_rules — defer (would be a nice "remember this" feature)
- Auto-categorize for income/refund detection — focus on Expense merchants
- Smart Member assignment — separate concern
