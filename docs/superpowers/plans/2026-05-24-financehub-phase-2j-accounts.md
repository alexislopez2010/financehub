# Phase 2J — Accounts surface

> Subagent-driven; ~4 dispatches.

**Goal:** Replace `/accounts` placeholder with the combined Accounts + Debt Calculator + CFO surface. Three in-page sections inside one route.

**Architecture:** Server-shell + Client root with section anchors (`?section=accounts|debt|cfo`). Each section is its own card group. Account balance derivation reuses the same approach as `lib/briefing/kpis.ts` — `starting_balance + signed activity`. Debt calculator uses `lib/finance/debt.simulatePayoff` from 2D with a strategy selector + extra-payment input. CFO summary computes year-to-date KPIs.

## File structure

```
apps/web/
├── app/(app)/accounts/
│   └── page.tsx                       Server shell
├── components/accounts/
│   ├── Accounts.tsx                   Client root with section nav (Accounts / Debt / CFO)
│   ├── SectionNav.tsx                 Sticky horizontal tabs for the three sections
│   ├── AccountsSection.tsx            List grouped by type + add/edit/archive
│   ├── AccountRow.tsx                 One account: name, institution, type pill, current balance, edit, archive
│   ├── AddAccountForm.tsx             Inline + Add account
│   ├── DebtSection.tsx                Debt calc with strategy + extra payment + payoff timeline
│   ├── DebtStrategySelector.tsx       Snowball/Avalanche/Min-only toggle
│   ├── PayoffSummary.tsx              Months-to-payoff + total interest + total paid
│   ├── DebtList.tsx                   Each debt with balance + apr + payoff month
│   ├── CfoSection.tsx                 YTD KPIs: net worth, savings rate, debt-to-income, etc.
│   └── *.test.tsx
└── lib/accounts/
    ├── balances.ts                    pure: per-account current balance via starting_balance + signed activity
    ├── cfo.ts                         pure: YTD financial KPIs
    └── *.test.ts
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | `lib/accounts/balances.ts` (pure) + tests. Accounts scaffold + SectionNav + AccountsSection (list + add + edit + archive). Replace placeholder. | `lib/accounts/balances.*`, `components/accounts/{Accounts,SectionNav,AccountsSection,AccountRow,AddAccountForm}.tsx`, `app/(app)/accounts/page.tsx` |
| 2 | DebtSection: strategy selector + extra-payment input + payoff summary + debt list. Uses `simulatePayoff` from 2D. | `components/accounts/{DebtSection,DebtStrategySelector,PayoffSummary,DebtList}.tsx` + new `lib/data/debts.ts` read hook (debts table already typed in database.types.ts) |
| 3 | `lib/accounts/cfo.ts` (pure) + tests. CfoSection: YTD KPI tiles + month-over-month spending comparison. | `lib/accounts/cfo.*`, `components/accounts/CfoSection.tsx` |
| 4 | Final wiring + verify (all tests, build, lint) + commit close-out. | `components/accounts/Accounts.tsx` final compose |

## Out of scope

- Net worth over time chart (Phase 3 — needs `account_balances` snapshots populated)
- Account reconciliation / starting-balance re-bases
- Real bank linking (Plaid etc.)
