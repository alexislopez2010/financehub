# Phase 3F — Ledger filter parity (inline pickers for every column)

> Subagent-driven; ~3 dispatches.

**Goal:** Make every column on the Ledger surface filterable directly from the toolbar, with the same interactive-chip pattern that Member just got in 3E.T2. Adds the missing **Amount range** filter (URL contract + backend + UI) and surfaces the description **Search** input as a visible toolbar field.

**Architecture:** Each filter gets its own small `*Filter.tsx` component under `components/ledger/filters/`. Same pattern as `MemberFilterChip`: Radix DropdownMenu / Popover, "Label ▼" chip when unset, "Label: value ✕" chip when set. Clean separation lets each picker manage its own UI (date inputs, amount inputs, lists, etc.) while sharing the chip visual. URL state remains the single source of truth — all pickers read from `LedgerFilters` and call `onChange` with patches.

## Current state

| Column | URL+backend | Inline picker | Clear-chip |
|---|---|---|---|
| Date | ✓ `start` + `end` | ❌ (bottom-sheet only) | ✓ |
| Description | ✓ `q` (substring) | ⚠ (in sheet) | — |
| Category | ✓ `category` | ❌ | ✓ |
| Account | ✓ `account` | ❌ | ✓ |
| **Member** | ✓ `member` | ✅ (Phase 3E.T2) | ✓ |
| **Amount** | ❌ | ❌ | ❌ |
| Type | ✓ `type` | ❌ | ✓ |

## File structure

```
apps/web/
├── lib/ledger/
│   ├── filters.ts                      EDIT — add minAmount + maxAmount to LedgerFilters; parse/serialize
│   └── filters.test.ts                 EDIT — new tests for amount round-trip + edge cases
├── lib/data/
│   ├── transactions.ts                 EDIT — apply minAmount / maxAmount in the Supabase query
│   └── transactions.test.tsx           EDIT — assert filters applied
├── components/ledger/
│   ├── FilterChips.tsx                 EDIT — orchestrator only; render the new filter components
│   ├── FilterSheet.tsx                 EDIT — mobile parity: Amount fields + match the new contract
│   └── filters/                        NEW directory
│       ├── DateRangeFilter.tsx
│       ├── AccountFilter.tsx
│       ├── CategoryFilter.tsx
│       ├── TypeFilter.tsx
│       ├── AmountFilter.tsx
│       ├── DescriptionSearch.tsx
│       └── *.test.tsx
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Add `minAmount` + `maxAmount` to `LedgerFilters` type. URL parse/serialize via `?amount_min=` and `?amount_max=`. Apply `gte` / `lte` in `useTransactions` query. Tests for the contract + backend filter. NO UI YET. | `lib/ledger/filters.*`, `lib/data/transactions.*` |
| 2 | Build the six filter components (Date, Account, Category, Type, Amount, Description). Replace passive chip rendering in `FilterChips.tsx` with interactive pickers. Pattern matches `MemberFilterChip` from 3E.T2. Tests for each picker. | `components/ledger/filters/*.tsx`, `components/ledger/FilterChips.tsx` |
| 3 | FilterSheet (mobile) parity — Amount fields + ensure all controls match the new contract. Final verify + close-out commit. | `components/ledger/FilterSheet.tsx` |

## T1 — Schema contract + backend (no UI)

### `lib/ledger/filters.ts`

Add fields:

```ts
export interface LedgerFilters {
  startDate?: string
  endDate?: string
  categoryId?: string | null
  account?: string
  member?: string
  type?: 'Income' | 'Expense' | 'Transfer' | 'Refund'
  q?: string
  // NEW:
  minAmount?: number    // signed amount (e.g. -500 for "spent at least $500")
  maxAmount?: number
}
```

URL params: `?amount_min=-500` and `?amount_max=500`. Parse as numbers, reject NaN. Round-trip preserved.

`isEmpty` updated to include the new fields.

`chipsFor` doesn't add amount chips — the picker handles its own chip rendering (T2 pattern).

Tests in `filters.test.ts`:
- amount round-trip (parse → serialize → parse)
- negative amount preserved
- non-numeric input rejected (NaN → undefined)
- isEmpty returns false when amount filter is set
- order-independence in URL params

### `lib/data/transactions.ts`

In the `useTransactions(filters)` query function, after the existing filter applications, add:

```ts
if (filters?.minAmount !== undefined && !Number.isNaN(filters.minAmount)) {
  q = q.gte('amount', filters.minAmount)
}
if (filters?.maxAmount !== undefined && !Number.isNaN(filters.maxAmount)) {
  q = q.lte('amount', filters.maxAmount)
}
```

Important: amount is a SIGNED number. `minAmount = -500` means "rows where amount >= -500" — so an expense of -$400 matches (because -400 >= -500), but -$600 does NOT (because -600 < -500). This is the standard greater-than-or-equal semantics; the UI should expose it as "Amount between X and Y" with clear labels.

Tests in `transactions.test.tsx`:
- minAmount alone applied as gte
- maxAmount alone applied as lte
- both applied
- skipped when undefined

## T2 — Filter components + FilterChips orchestrator

### Common pattern (each `*Filter.tsx` component)

```ts
'use client'

export interface XFilterProps {
  value: <whatever shape this filter holds>
  onChange: (next: <shape>) => void
}

export function XFilter({ value, onChange }: XFilterProps): JSX.Element {
  // Renders:
  //   - "Label ▼" chip when value is undefined / cleared
  //   - "Label: <displayValue> ✕" chip when set; click ✕ → onChange(undefined/cleared)
  //   - Click chip body (not ✕) → opens Radix DropdownMenu OR Popover with the picker UI
}
```

Visual: match the existing chip styling exactly (`rounded-full px-3 py-1 text-sm`, border, hover state). MemberFilterChip is the template.

### `DateRangeFilter.tsx`

Holds `{ startDate?: string; endDate?: string }`. Popover contains two `<input type="date">` inputs labeled "From" and "To". Apply button writes back via onChange. Quick chips for common ranges ("Last 30 days", "This month", "Last month", "YTD") above the inputs for fast access.

Chip label:
- Unset: `Date ▼`
- Set: `Date: 5/1 – 5/24 ✕` (use `MMM D` format; abbreviated)

### `AmountFilter.tsx`

Holds `{ minAmount?: number; maxAmount?: number }`. Popover contains two `<input type="number" step="0.01">` inputs labeled "Min" and "Max" with `$` prefix. Helper text under: "Use negative numbers for expenses, e.g. min = -500 means 'at least $500 spent'." Apply button.

Quick chips for common ranges above the inputs: "Over $100" (min=100), "Expenses ≥ $500" (max=-500), "Income only" (min=0). Match user mental model — most people want "show me transactions over $X" not "minAmount=X".

Chip label:
- Unset: `Amount ▼`
- Set:
  - both: `Amount: -$500 to $500 ✕`
  - only min: `Amount ≥ $100 ✕`
  - only max: `Amount ≤ $500 ✕`

### `AccountFilter.tsx`

Holds `{ account?: string }`. Uses `useAccounts()` for the list. DropdownMenu with each account name. Same de-dup + empty-state logic as MemberFilterChip.

Chip label:
- Unset: `Account ▼`
- Set: `Account: Citibank ✕`

### `CategoryFilter.tsx`

Holds `{ categoryId?: string | null }`. Uses `useCategories()`. DropdownMenu items: special "Uncategorized" (value=null) + each category name. Search-as-you-type filtering inside the dropdown if the list is long (>15 categories).

Chip label:
- Unset: `Category ▼`
- Set null (Uncategorized): `Category: Uncategorized ✕`
- Set: `Category: Food & Dining ✕`

### `TypeFilter.tsx`

Holds `{ type?: 'Income' | 'Expense' | 'Transfer' | 'Refund' }`. DropdownMenu with the four type values.

Chip label:
- Unset: `Type ▼`
- Set: `Type: Expense ✕`

### `DescriptionSearch.tsx`

Different shape — not a chip but a visible `<input>` in the toolbar. Magnifying-glass icon on the left. Placeholder: "Search descriptions…". Debounced 200ms before calling `onChange({ q: value })`. Clear button (×) on the right when value is non-empty.

This is the most visible control — put it FIRST in the toolbar row, full-width on mobile, ~240px on desktop.

### `FilterChips.tsx` — orchestrator

After the refactor, FilterChips becomes thin:

```tsx
export function FilterChips({ filters, onChange, onOpenSheet, className }: FilterChipsProps) {
  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      <DescriptionSearch
        value={filters.q ?? ''}
        onChange={(q) => onChange({ ...filters, q: q || undefined })}
      />
      <DateRangeFilter
        value={{ startDate: filters.startDate, endDate: filters.endDate }}
        onChange={(v) => onChange({ ...filters, ...v })}
      />
      <AccountFilter value={filters.account} onChange={(account) => onChange({ ...filters, account })} />
      <CategoryFilter value={filters.categoryId} onChange={(categoryId) => onChange({ ...filters, categoryId })} />
      <MemberFilter value={filters.member} onChange={(member) => onChange({ ...filters, member })} />
      <AmountFilter
        value={{ minAmount: filters.minAmount, maxAmount: filters.maxAmount }}
        onChange={(v) => onChange({ ...filters, ...v })}
      />
      <TypeFilter value={filters.type} onChange={(type) => onChange({ ...filters, type })} />

      {/* Mobile: bottom-sheet button */}
      {onOpenSheet && (
        <button onClick={onOpenSheet} className="...md:hidden">
          More filters
        </button>
      )}
    </div>
  )
}
```

The existing `MemberFilterChip` (from 3E.T2) gets extracted to `filters/MemberFilter.tsx` to keep the pattern consistent. Same logic, new file location.

### Tests

For each filter component (`*.test.tsx`): 3-4 cases each:
- Renders unset state ("X ▼")
- Renders set state with value + clear button
- Picking a value fires `onChange` with the right shape
- ✕ click clears the filter

That's ~24 component tests + existing FilterChips tests still passing (likely needs adjustments because the orchestration changed).

## T3 — FilterSheet parity + close-out

### `FilterSheet.tsx`

Mobile bottom-sheet currently has fields for the existing filters. Add:
- Min/Max amount inputs (same as AmountFilter's content)
- Make sure all controls match the new contract

The sheet stays as a full-form alternative to the inline pickers (useful on small screens or when setting many filters at once).

### Final verify

```
npm run test --workspace=@financehub/web
npm run lint --workspace=@financehub/web
cd apps/web && npx tsc --noEmit
npm run build --workspace=@financehub/web
```

Expected: ~810-815 tests passing. Build green.

### Commit close-out

```
feat(ledger): Phase 3F — inline pickers for every filter column

Closes Phase 3F. Every column on the Ledger surface is now filterable
directly from the toolbar via an interactive chip:
- Description: visible search input with debounce
- Date: range picker with quick-range chips
- Account: dropdown
- Category: dropdown with Uncategorized + each category
- Member: existing (from 3E.T2)
- Amount: NEW — min/max range with quick chips ("Over $100",
  "Expenses ≥ $500", "Income only")
- Type: dropdown

Each picker matches the MemberFilterChip pattern: "X ▼" chip when
unset, "X: value ✕" when set. FilterChips becomes a thin orchestrator
over the new filters/* components.

Mobile FilterSheet kept as a full-form alternative; gets the Amount
fields too.

Backend: useTransactions now applies gte/lte against the signed amount
column for minAmount/maxAmount.

Tests: N passing (+M new across the 6 picker components + filter
contract round-trip).
```

## Success criteria

- Click any chip in the Ledger toolbar → picker opens → pick a value → list filters live + URL updates
- Amount picker: "Min -$500 Max $0" filters to "expenses up to $500"
- Amount quick-chip "Income only" sets `min=0` → filters to non-negative rows
- Description search input shows up as a visible field (no need to open the sheet)
- Every chip clear (✕) removes that filter and resets the list
- Mobile bottom-sheet still works as a full-form alternative
- All existing tests pass; new tests cover the 6 picker components + the amount contract

## Out of scope

- Saving filter presets ("My usual view") — defer
- Date range natural-language input ("last 3 months") beyond the quick chips — defer
- Multi-select on Account / Category / Type — defer (single-value matches existing backend)
- Column-header click-to-filter (Excel-style) — alternative path explicitly not picked
- Server-side full-text search (description q is still client-friendly substring) — defer
