# Phase 2I — Bills surface

> Subagent-driven; ~3 dispatches.

**Goal:** Replace `/bills` placeholder with the real Bills surface — sortable list of recurring bills with next-due-date, budgeted amount, matched-actual-this-period, inline edit, add, delete, and per-bill expansion showing matched transactions.

**Architecture:** Server-shell + Client root. URL-synced sort state (`?sort=due|amount|name|category`). One card containing the bill list with column-header sorts. Per-bill expansion (collapsible row) showing matched transactions from `lib/finance/billsMatch.matchBills` using `bill_match_rules` from Phase 1. Mutations via existing `useUpdate/Create/DeleteBill` hooks.

## File structure

```
apps/web/
├── app/(app)/bills/
│   └── page.tsx                       Server shell mounting Bills
├── components/bills/
│   ├── Bills.tsx                      Client root: sort state + data composition
│   ├── BillsSummary.tsx               2 KpiTiles at top (Due This Month, Active Bills count)
│   ├── BillList.tsx                   Card with sortable column headers + bill rows
│   ├── BillRow.tsx                    One bill row: name, freq, next-due, budget, actual, variance, actions
│   ├── BillExpanded.tsx               Inline expansion showing matched transactions
│   ├── AddBillForm.tsx                Inline "+ Add bill" form
│   └── *.test.tsx
└── lib/bills/
    ├── sort.ts                        Sort key parsing + comparator factory + tests
    └── billStatus.ts                  pure: derive next-due-date + days-until + status badge tone
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | `lib/bills/sort.ts` + `billStatus.ts` (pure) + tests. Bills scaffold + BillList (read-only) + sort. BillsSummary tiles. Replace placeholder page. | `lib/bills/*`, `components/bills/{Bills,BillsSummary,BillList,BillRow}.tsx`, `app/(app)/bills/page.tsx` |
| 2 | Inline edit (budget_amount, due_day, name) via EditableCell. Per-row delete with confirmation. AddBillForm (name, due_day, frequency, amount, category). | `components/bills/{AddBillForm}.tsx` + edits to BillRow/BillList |
| 3 | Per-bill expansion: clicking a row reveals matched transactions list (via `matchBills` + `bill_match_rules`). Verify all tests + lint + build; commit close-out. | `components/bills/BillExpanded.tsx` + edits |

## Out of scope

- Bill match rule editor (each bill's matching rules) — deferred to 2L Admin
- Promote bill back to one-off transaction
- Bill snooze / pause
