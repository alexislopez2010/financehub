# Phase 3E — Per-transaction member assignment

> Subagent-driven; ~3 dispatches.

**Goal:** Every transaction can be assigned to a specific household member (or 'Family' for shared expenses). Closes the gap left by Phase 2G where the `member` column was deliberately read-only. Backfills the 499 transactions currently missing assignment via row-edit + bulk-assign UX.

**Architecture:** No schema change. Existing `transactions.member` text column stays as-is — values are display names ('Alexis Lopez', 'Marilyn Lopez', 'Family', etc.). New `useHouseholdMembersList` hook does a direct `SELECT` on `household_members` under RLS (any member of the household can see the roster). Dropdown options = each household_members row's `display_name` + a synthetic `'Family'` entry + `null` for unassigned. Existing `useUpdateTransaction` already supports the `member` field for inline edit.

## Current state (verified)

- `transactions.member` (text, nullable) — exists
- 133 of 632 rows assigned (`Alexis Lopez`, `Marilyn Lopez`, `Family`); **499 unassigned**
- Backend `useTransactions({ member })` filter — already supported
- URL filter contract supports `?member=` — already supported
- RLS on `household_members`: `view own memberships` policy permits `(user_id = auth.uid()) OR is_household_member(household_id)` — any household member can SELECT all rows for their household. **No new RPC required.**

## File structure

```
apps/web/
├── lib/data/
│   ├── householdMembers.ts             NEW — non-admin hook: useHouseholdMembersList (direct SELECT under RLS)
│   └── householdMembers.test.tsx       NEW — tests
├── lib/ledger/
│   └── memberOptions.ts                NEW — pure: build dropdown options from household_members + synthetic Family + Unassigned
├── components/ledger/
│   ├── TransactionRow.tsx              EDIT — show member; inline edit via EditableCell select
│   ├── FilterChips.tsx                 EDIT — add Member filter chip
│   ├── FilterSheet.tsx                 EDIT — add Member field in mobile sheet
│   ├── BulkActionsBar.tsx              EDIT — add Assign Member dropdown when ≥1 selected
│   ├── Ledger.tsx                      EDIT — wire bulk-assign mutation
│   └── import/
│       └── UploadStep.tsx              EDIT — add Member dropdown alongside Account
├── lib/import/
│   └── insert.ts                       EDIT — pass member through to inserted rows
└── lib/import/adapters/types.ts        EDIT — ImportRow.member field (nullable)
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | `lib/data/householdMembers.ts` + `useHouseholdMembersList` (non-admin SELECT under RLS) + tests. `lib/ledger/memberOptions.ts` pure helper. Display + inline-edit Member column in `TransactionRow` via EditableCell (select variant). | `lib/data/householdMembers.*`, `lib/ledger/memberOptions.*`, `components/ledger/TransactionRow.tsx` |
| 2 | Member filter chip (FilterChips + FilterSheet) + Bulk-assign Member action in BulkActionsBar wired to a batched UPDATE in Ledger.tsx. Tests. | `components/ledger/{FilterChips,FilterSheet,BulkActionsBar,Ledger}.tsx` |
| 3 | Import flow: Member selector in UploadStep, wired through ImportFlow payload and `insert.ts` so all imported rows get the selected member. Final verify + close-out commit. | `components/ledger/import/UploadStep.tsx`, `components/ledger/import/ImportFlow.tsx`, `lib/import/{insert,adapters/types}.ts` |

## Pure module specs

### `lib/data/householdMembers.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'

export interface HouseholdMemberListRow {
  user_id: string
  display_name: string
  role: 'owner' | 'member'
}

/**
 * Non-admin hook. Returns all members of the current household via a
 * direct SELECT under the existing 'view own memberships' RLS policy.
 * Distinct from useHouseholdMembers in lib/data/admin.ts which uses
 * the admin RPC (owner-gated).
 */
export function useHouseholdMembersList(): UseQueryResult<HouseholdMemberListRow[], Error>
```

Implementation:
```ts
return useQuery({
  queryKey: ['household_members_list', LOPEZ_HOUSEHOLD_ID],
  queryFn: async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('household_members')
      .select('user_id, display_name, role')
      .eq('household_id', LOPEZ_HOUSEHOLD_ID)
      .order('display_name', { ascending: true })
    if (error) throw error
    return (data ?? []) as HouseholdMemberListRow[]
  },
  staleTime: 5 * 60 * 1000  // 5 minutes — roster rarely changes
})
```

Tests: happy path (rows returned, ordered), error path, empty path.

### `lib/ledger/memberOptions.ts`

Pure module that takes the household_members list and returns the dropdown options including the synthetic ones:

```ts
export interface MemberOption {
  value: string | null    // null = unassigned; 'Family' = shared; else display_name
  label: string           // display label
  kind: 'unassigned' | 'family' | 'member'
}

export function buildMemberOptions(
  members: ReadonlyArray<{ display_name: string }>,
  /** Legacy values found in existing data that aren't in household_members
   *  (e.g. former members). Preserved so the dropdown still has an option
   *  matching the row's current value. */
  legacyValues?: ReadonlyArray<string>
): ReadonlyArray<MemberOption> {
  // 1. '(Unassigned)' option with value=null
  // 2. 'Family' synthetic option
  // 3. Each member's display_name
  // 4. Any legacyValues not already covered, appended as kind='member'
  // De-dup by value.
}
```

Tests:
- empty members → just [Unassigned, Family]
- 3 members + Family in data → all 5 options
- legacy value not in current members → appended at end with kind='member'
- de-dup (legacy value === current member name)

### `transactions.member` editing

`useUpdateTransaction` already accepts a `patch` arg shape that includes `member`. Verify before relying on it (read the existing type). If not, add `member` to the patch type — should be `string | null`.

## UI specs

### `TransactionRow.tsx` — display + inline edit

Add a `Member` column. Place it between `Account` and the amount (or wherever fits in the existing row layout — match the column widths used by similar fields).

- Read state: show member name, or muted italic `Unassigned` when null.
- Inline edit: clicking opens an EditableCell select with options from `buildMemberOptions(members, [tx.member].filter(Boolean))`. Picking an option calls `useUpdateTransaction({ id: tx.id, patch: { member: option.value } })`. The `'Family'` option writes the literal string `'Family'`.

Look at `apps/web/components/ledger/EditableCell.tsx` — there's already a `select` variant from Phase 2G. Reuse it.

### `FilterChips.tsx` — Member filter chip

In the existing chip row, add a new chip after the Account chip:

```tsx
<MemberFilterChip
  value={filters.member ?? null}
  members={members}
  onChange={(v) => updateFilters({ member: v ?? undefined })}
/>
```

The chip when set shows `Member: Alexis Lopez ✕` (clearable). When unset, shows `Member ▼` and clicking opens a popover/dropdown with all member options.

Use Radix Popover for the dropdown surface to keep with the existing primitive set.

### `FilterSheet.tsx` — Mobile Member field

Add a "Member" select field in the same form layout as the existing Account select. Same options.

### `BulkActionsBar.tsx` — Bulk-assign action

Currently shows "Delete N selected" when ≥1 row is selected. Add a second action: "Assign member" dropdown that pops a small menu with member options. Picking one calls a bulk-update mutation (see Ledger.tsx wiring below).

Layout:
```
[ Cancel ] [ Assign member ▼ ]  [ Delete (N) ]
```

### `Ledger.tsx` — bulk-update wiring

Add a helper that runs a loop of `useUpdateTransaction` over each selected row (mirrors how bulk-delete works in 2G.T3). Each per-row update is optimistically applied. On any row error, surface a toast/error inline; rollback already happens per-row in the existing mutation.

For 50+ selected rows this is many round-trips. Acceptable for now (the existing bulk-delete uses the same pattern). Future: bulk RPC if it becomes painful.

### `import/UploadStep.tsx` — Per-file member selector

Add a second dropdown next to the Account selector. Required before the dropzone is enabled (same gating as Account). Options come from `useHouseholdMembersList()` + Family + Unassigned (default to Unassigned since the existing data has mostly-null members).

State: `const [selectedMember, setSelectedMember] = useState<string | null>(null)`

Pass `member: selectedMember` through to the ImportPayload. Modify `ImportFlow.tsx` to include `member` in the payload shape.

### `import/insert.ts` — Member on import

Add `member: string | null` to the `InsertArgs` interface. Inside `toInsertRow`, write `member: args.member`.

### `import/adapters/types.ts` — ImportRow.member field

Add `member: string | null` to the `ImportRow` interface. Adapters don't set it (they don't know it); the importer caller fills it from the user-selected default before calling `insert.ts`. Simpler: set `member` in the ImportRow during the UploadStep pipeline, not in adapters.

Actually simpler: pass `member` as an `InsertArgs` parameter (not on each row) since it's the same for the whole file. So `adapters/types.ts` doesn't need to change. The per-row override (in case user wants to customize in PreviewStep) is OUT OF SCOPE for this iteration — the plan said per-file default only.

Decision: **Do NOT add `member` to ImportRow.** Pass it once via `InsertArgs.member`. Simpler.

## Success criteria

- Member column visible in every Ledger row (read state)
- Click a member cell → dropdown of options → pick → cell updates immediately (optimistic) + persists
- 'Family' option writes the literal string `'Family'` (matches existing data)
- '(Unassigned)' option writes `null`
- Member filter chip on desktop + Member field in mobile filter sheet — URL syncs (`?member=Alexis%20Lopez`)
- Bulk-assign: select 5 rows → "Assign member" → pick Marilyn → all 5 rows update
- Import: pick Account + Member at upload → all imported rows get the selected member written
- 499 unassigned rows can be filtered to and bulk-assigned in a few clicks
- All existing tests still pass; new tests cover the hook + memberOptions + smoke tests for the UI changes

## Out of scope

- Per-row member override in import preview (per-file default is enough; user edits individual rows in Ledger if needed)
- Migrating `transactions.member` text column to a FK against `household_members` (heavier schema change; defer)
- Member breakdown card on Briefing (per-member spend) — future enhancement
- Renaming household_members display_name with automatic propagation to existing transactions.member values (manual rename for now; rare event)
- 'Shared between X and Y' (multi-member rows) — defer; 'Family' covers most of this
- Bulk-assign via the existing keyboard shortcuts (defer)
- A per-member view in CFO / Accounts (future)
