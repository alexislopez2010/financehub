# Phase 2K — Spotlight find

> Subagent-driven; ~3 dispatches.

**Goal:** Replace the placeholder Find group in `SpotlightDialog` with live cross-surface search across transactions, bills, accounts, and categories. Selecting a hit navigates to its source surface with the relevant filter pre-applied.

**Architecture:** The Cmd-K shortcut, dialog, overlay, and "Jump" group are already wired (Phase 2C). 2K adds a pure scorer + a hook that reads from the TanStack Query cache (no new endpoints — the data is already in memory for any signed-in user who has touched the app). The dialog renders four grouped result lists (Transactions / Bills / Accounts / Categories) below the existing Jump group; selecting a hit calls `router.push` with a deep link.

**Why client-side search:** Household corpus is small (~700 transactions, ~30 bills, ~15 accounts, ~80 categories — all already cached by TanStack). Pure substring + token matching is instant, removes a network round-trip from every keystroke, and keeps the spotlight responsive while the user is typing. The "ask anything" LLM-backed variant is explicitly deferred to a later phase (AI layer is out of scope for the rewrite).

## File structure

```
apps/web/
├── components/spotlight/
│   ├── SpotlightDialog.tsx               EDIT — replace placeholder Find group with live groups
│   ├── SpotlightResultGroup.tsx          NEW — generic Command.Group renderer for a hit list
│   └── *.test.tsx
└── lib/spotlight/
    ├── search.ts                         pure: corpus + query → SpotlightHit[] grouped by type
    ├── search.test.ts
    ├── useSpotlightSearch.ts             hook: reads TanStack cache, calls pure search, returns groups
    └── useSpotlightSearch.test.tsx
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | `lib/spotlight/search.ts` (pure) + tests. Tokenises the query, scans transactions/bills/accounts/categories, returns scored + grouped `SpotlightHit[]`. | `lib/spotlight/search.*` |
| 2 | `useSpotlightSearch` hook reading from TanStack Query cache (no new fetches — uses `queryClient.getQueryData` for already-loaded data). Returns memoised grouped hits + counts. Tests with a mocked QueryClient. | `lib/spotlight/useSpotlightSearch.*` |
| 3 | Wire `SpotlightDialog` to live results via `useSpotlightSearch(search)`. Extract `SpotlightResultGroup.tsx` for the 4 type sections. Each hit's `onSelect` navigates to the deep link. Verify all tests + lint + build; commit close-out. | `components/spotlight/SpotlightDialog.tsx`, `components/spotlight/SpotlightResultGroup.tsx` |

## Pure module spec

### `lib/spotlight/search.ts`

```ts
export type SpotlightHitKind = 'transaction' | 'bill' | 'account' | 'category'

export interface SpotlightHit {
  kind: SpotlightHitKind
  /** Stable id (uuid for db rows; category name for synthetic categories). */
  id: string
  /** Primary label shown in the spotlight item. */
  label: string
  /** Secondary line (e.g. "MAY 12 · $42.18" for a transaction; "Monthly · Due 15" for a bill). */
  detail?: string
  /** Deep link to navigate to on select. */
  href: string
  /** Relevance score; higher is better. Used for sorting within a group. */
  score: number
}

export interface SpotlightCorpus {
  transactions: ReadonlyArray<TransactionRow>
  bills: ReadonlyArray<BillRow>
  accounts: ReadonlyArray<AccountRow>
  categories: ReadonlyArray<CategoryRow>
}

/**
 * Pure cross-surface search.
 * - Empty/whitespace query → returns empty array (caller falls back to placeholders).
 * - Tokenises on whitespace, case-insensitive substring match per token.
 * - Each token must match somewhere in the row's searchable text (AND semantics).
 * - Score = sum of (token length / matched-field length) per match — short query in long
 *   field gets a low score; full-word matches in short fields score highest.
 * - Caps per group: 8 transactions, 5 bills, 5 accounts, 5 categories.
 */
export function searchEverything(
  corpus: SpotlightCorpus,
  query: string
): ReadonlyArray<SpotlightHit>
```

Searchable fields per kind:

| Kind | Fields |
|------|--------|
| transaction | `description`, `category`, `account`, `member` |
| bill | `name`, `category`, `frequency` |
| account | `name`, `institution`, `account_type` |
| category | `name` |

Deep links:

| Kind | href |
|------|------|
| transaction | `/ledger?q=<encoded description token>` (uses the existing `q` ledger filter from 2G) |
| bill | `/bills?focus=<bill_id>` (Bills surface scrolls to the row; new query param to support this) |
| account | `/accounts?focus=<account_id>` (Accounts surface scrolls to the row) |
| category | `/ledger?category=<category_id>` (Ledger filter from 2G) |

Bills and Accounts focus params: introduce a small `useEffect` in `BillList`/`AccountsSection` that reads `?focus=<id>` and calls `scrollIntoView({ block: 'center' })` once on mount. This is a small read-only addition in the existing surfaces (no breaking changes).

## Hook spec

### `lib/spotlight/useSpotlightSearch.ts`

```ts
export interface SpotlightSearchResult {
  hits: ReadonlyArray<SpotlightHit>
  groups: {
    transactions: ReadonlyArray<SpotlightHit>
    bills: ReadonlyArray<SpotlightHit>
    accounts: ReadonlyArray<SpotlightHit>
    categories: ReadonlyArray<SpotlightHit>
  }
  isEmpty: boolean
}

/**
 * Reads already-cached corpus from TanStack Query (does NOT trigger fetches).
 * If a corpus type isn't in cache yet, it's treated as empty for that group.
 * Memoised on (query, cache mtime) — recomputes only when the query changes
 * or the cached data updates.
 */
export function useSpotlightSearch(query: string): SpotlightSearchResult
```

Implementation notes:
- Uses `useQueryClient()` + `queryClient.getQueryData(queryKeys.transactions())` etc.
- Reuses the existing keys from `lib/data/keys.ts`. For transactions, reads the unfiltered key — typical session has transactions cached at the unfiltered key from the Ledger 90-day default fetch.
- Subscribes to cache updates via `useSyncExternalStore` so newly loaded data appears without re-render churn.

## Dialog wiring (T3)

`SpotlightDialog.tsx` changes:
- Pass `cmdk`'s `shouldFilter={false}` (we filter ourselves via the hook — preserves our scoring + caps).
- Remove the placeholder Find group.
- Render `<SpotlightResultGroup>` four times (one per kind) only when its hit list is non-empty.
- `Command.Empty` still triggers when all four groups are empty AND the query is non-blank.
- When the query is blank, the Find groups don't render at all (only Jump remains).

`SpotlightResultGroup.tsx`:
- Props: `heading: string`, `hits: SpotlightHit[]`, `Icon: LucideIcon`, `onSelect(hit)`.
- One `Command.Group` containing one `Command.Item` per hit. Item's `value` is `<kind> <label> <id>` so cmdk's keyboard nav works even though we set `shouldFilter={false}`.
- Same row styling as the existing Jump items: icon + label + optional detail + ArrowRight on selected.

## Success criteria

- Typing in Spotlight populates real grouped hits within ~16ms (1 frame) for the cached corpus
- Empty query → only Jump group visible (current behaviour preserved)
- Selecting a transaction hit navigates to `/ledger?q=…` and the ledger pre-filters to that search term
- Selecting a bill hit navigates to `/bills?focus=<id>` and the matching bill scrolls into view
- Selecting an account hit navigates to `/accounts?focus=<id>` and the matching account scrolls into view
- Selecting a category hit navigates to `/ledger?category=<id>` filtered to that category
- Keyboard nav (↑/↓/Enter/Esc) still works through all groups
- All previous tests still pass; new tests cover `searchEverything` (tokenisation, scoring, caps, deep links) + `useSpotlightSearch` (cache reads, memoisation)
- No new network calls — verified by reading from cache only

## Out of scope

- "Ask anything" natural-language box (AI layer deferred until after cutover)
- Server-side fuzzy search / Postgres trigram (corpus is small enough for client-side)
- Recent / pinned items (deferred)
- Result preview pane (deferred)
- Spotlight history (deferred)
