# Phase 2G — Ledger surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build the transactions list — read, filter, paginate-by-month, select, edit inline, bulk-delete, promote to bill. Most interactive surface; establishes patterns the other surfaces (2H, 2I, 2J) will reuse.

**Architecture:** `(app)/ledger/page.tsx` is a Server Component shell; the real work lives in a Client Component that holds URL-driven filter state, subscribes to `useTransactions(filters)`, derives a month-grouped view, and renders rows with optional inline editing. Mutations route through the existing `useUpdateTransaction` / `useDeleteTransaction` / `useCreateBill` hooks (so optimistic updates + rollback are free). All visible content lives inside dashboard-aesthetic cards — white surface, ring/border-rule, bold numerals, vibrant tone colors.

**Tech Stack:** Existing — TanStack Query (2E), `lib/data/*` hooks, Radix Dialog (already installed), lucide-react icons, Tailwind. No new runtime deps.

---

## File structure

```
apps/web/
├── app/(app)/ledger/
│   └── page.tsx                       Server shell; mounts Ledger client
├── components/ledger/
│   ├── Ledger.tsx                     Client root: URL filter state + data composition
│   ├── FilterChips.tsx                Desktop chip-row + search input
│   ├── FilterSheet.tsx                Mobile bottom-sheet wrapping the same filter controls
│   ├── TransactionList.tsx            Month-grouped list with sticky headers
│   ├── TransactionRow.tsx             Single row (checkbox, date, desc, category, account, amount)
│   ├── LedgerFooter.tsx               Sum-of-filtered totals (income/expense/net), sticky
│   ├── BulkActionsBar.tsx             Sticky toolbar when ≥1 row selected
│   ├── EditableCell.tsx               Generic inline-edit cell (text + select variants)
│   ├── PromoteToBillMenu.tsx          Row-context dropdown w/ "Promote to bill" action
│   └── *.test.tsx                     Vitest where logic is testable
└── lib/ledger/
    ├── filters.ts                     URL ↔ TransactionFilters parsing + serialization
    ├── filters.test.ts
    ├── groupByMonth.ts                Pure: transactions[] → month-grouped[]
    └── groupByMonth.test.ts
```

---

## Task list

| # | Task | Files |
|---|---|---|
| 1 | URL filter state + FilterChips + FilterSheet. Ledger.tsx root composes hooks + filters. Pure `filters.ts` URL <-> TransactionFilters parsing + tests. Replaces ledger placeholder page. | `lib/ledger/filters.*`, `components/ledger/{Ledger,FilterChips,FilterSheet}.tsx`, `app/(app)/ledger/page.tsx` |
| 2 | TransactionList + month grouping + sticky headers + read-only TransactionRow. `groupByMonth.ts` pure module + tests. | `lib/ledger/groupByMonth.*`, `components/ledger/{TransactionList,TransactionRow}.tsx` |
| 3 | Sum-of-filtered footer (sticky) + bulk select (checkbox column + BulkActionsBar with bulk-delete). | `components/ledger/{LedgerFooter,BulkActionsBar}.tsx` |
| 4 | Inline edit on category + description + amount via EditableCell, wired to `useUpdateTransaction`. Plus PromoteToBillMenu wired to `useCreateBill`. | `components/ledger/{EditableCell,PromoteToBillMenu}.tsx` |
| 5 | Final verify (all tests, build, lint, Playwright smoke check); commit close-out. | n/a |

---

## URL filter contract

`apps/web/lib/ledger/filters.ts` exports `parseFiltersFromUrl(params: URLSearchParams)` and `serializeFiltersToUrl(filters)`. Round-trip preserved. The result is a `TransactionFilters` (the shape already defined in `lib/data/keys.ts`) plus an `q?: string` for free-text search (applied client-side post-fetch — the data layer doesn't need to know about it).

Recognised params:
- `start` (YYYY-MM-DD), `end` (YYYY-MM-DD), `category` (uuid or "uncategorized"), `account` (string), `member` (string), `type` (Income/Expense/Transfer/Refund), `q` (string).

Default when no params: last 90 days, no other filters.

## Month grouping

`apps/web/lib/ledger/groupByMonth.ts` exports `groupByMonth(transactions)` returning `[{ ym: '2026-05', label: 'May 2026', items: TransactionRow[], total: number }]` sorted newest first. Pure + tested.

## Inline edit fields

For Phase 2G, three fields are inline-editable:
- **description** — text input
- **category** — select bound to `useCategories()` data
- **amount** — number input

`account` and `member` stay read-only for now (Phase 2H Plan + 2J Accounts surface them differently).

On blur/Enter → call `useUpdateTransaction({ id, patch })`. On Esc → discard. Optimistic update is already baked into the mutation hook.

## Bulk actions

For Phase 2G:
- **Delete selected** — calls `useDeleteTransaction` in a loop. Each deletion is its own optimistic update; rollback is per-row. Phase 2J can introduce a server-side bulk RPC if needed.

Re-categorize-many is deferred.

## Promote to bill

Row dropdown action. Opens a small confirmation popover (Radix Dialog or Popover) with prefilled fields:
- `name` — defaults to transaction.description (trimmed to 40 chars)
- `budget_amount` — defaults to abs(transaction.amount)
- `due_day` — defaults to transaction.date's day-of-month
- `frequency` — defaults to "Monthly"
- `category` — defaults to transaction.category

Submit → `useCreateBill(payload)`. Show toast on success.

## Success criteria

- `/ledger` renders against live data with no console errors
- Filters via chips on desktop, bottom-sheet on mobile, URL-synced both ways
- Month-grouped list with sticky headers
- Sum-of-filtered footer updates live as filters change
- Bulk select + bulk delete works with optimistic UX
- Inline edit works for description/category/amount with optimistic UX
- Promote-to-bill creates a bill prefilled from the source transaction
- All previous tests still pass; new tests cover pure filter parsing + groupByMonth + EditableCell
- Mobile (< 768px) works: bottom-sheet filters, single-column row layout, footer sticky, bulk toolbar reachable

## Out of scope

- Virtualisation (deferred; 700 rows renders acceptably without; add when needed)
- Re-categorize many (defer to 2H or 2J)
- Server-side bulk delete RPC (per-row mutation loop is fine for now)
- Multi-select drag-to-select (deferred; checkboxes only)
- CSV import (the legacy migrate_from_excel.py covers this out-of-band; no new code needed)
