# Phase 2D — `lib/finance/*` pure modules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Port the five financial algorithms from the legacy Vite app's `Dashboard.jsx` into pure-function TypeScript modules in `apps/web/lib/finance/`, each with full Vitest coverage (100% target). The algorithms become the source of truth; the rest of Phase 2 just renders their output.

**Architecture:** Each module exports typed pure functions over plain data — no Supabase dependency, no DOM, no React. Inputs are typed `Readonly<…>` arrays matching DB row shapes (camelCase TS aliases over the snake_case columns where it improves readability — but a single canonical shape per module). Outputs are deterministic and serialisable. Every known regression from the legacy commit history gets a named test case so it never returns.

**Tech Stack:** TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Vitest. No new dependencies.

---

## File structure

```
apps/web/lib/finance/
├── types.ts                 # shared row shapes (TransactionRow, BillRow, IncomePlanRow, DebtRow, BillMatchRule)
├── dueDate.ts               # clampDay, isDueOn, daysUntilDue
├── dueDate.test.ts
├── billsMatch.ts            # matchBills + scoreBillTransaction (uses bill_match_rules)
├── billsMatch.test.ts
├── incomeMatching.ts        # matchIncome (source-keyword fuzzy match)
├── incomeMatching.test.ts
├── debt.ts                  # simulatePayoff (snowball/avalanche/min-only, escrow-aware)
├── debt.test.ts
├── forecast.ts              # forecast30Day (cash-basis transactions + bills + income)
└── forecast.test.ts
```

---

## Source legacy code (where to port from)

The relevant algorithms live in `apps/legacy/src/components/Dashboard/Dashboard.jsx`:

| New module | Legacy location | Approx lines |
|---|---|---|
| `dueDate.ts` | scattered `clampDay`, `isDueOn` helpers + inline arithmetic | ~30 |
| `billsMatch.ts` | `BILL_TX_MAP`, `BILL_NAME_KW`, `billsComparison` useMemo | 2124–2290 |
| `incomeMatching.ts` | `incomePlanVsActual` useMemo (source-keyword matching) | 2178–2263 |
| `debt.ts` | `simulate()` function in `DebtTracker` component | 968–1014 |
| `forecast.ts` | 30-day forecast IIFE | 2484–2595 |

Subagent dispatches MUST read the legacy code as the porting reference. Fix known bugs in the port (off-by-one in cash-basis forecast, escrow subtraction in debt, due-day clamping for short months).

---

## Task list

| # | Task | Files |
|---|---|---|
| 1 | `types.ts` + `dueDate.ts` (foundational; other modules import these) + tests | `types.ts`, `dueDate.ts`, `dueDate.test.ts` |
| 2 | `billsMatch.ts` reading from the `bill_match_rules` shape (Phase 1 table) + tests | `billsMatch.ts`, `billsMatch.test.ts` |
| 3 | `incomeMatching.ts` (source-keyword fuzzy match) + tests | `incomeMatching.ts`, `incomeMatching.test.ts` |
| 4 | `debt.ts` (snowball / avalanche / min-only, escrow-aware) + tests | `debt.ts`, `debt.test.ts` |
| 5 | `forecast.ts` (30-day cash-basis projection) + tests | `forecast.ts`, `forecast.test.ts` |
| 6 | Coverage report (`vitest --coverage` on `lib/finance/**`); confirm ≥98% lines/branches; commit final state | n/a — verification only |

---

## Required regression tests (per spec)

- `forecast.test.ts` includes the **cash-basis off-by-one** scenario from legacy commit `83a1827`
- `debt.test.ts` includes the **escrow subtraction** scenario from legacy commit `3449765`
- `dueDate.test.ts` includes all month-end edge cases: Feb 28/29 (leap year), Apr 30, day=31 across all months, year boundaries
- `incomeMatching.test.ts` includes the keyword-collision case from legacy commit `f5b5d4e`
- `billsMatch.test.ts` includes a multi-account bill + a name_keyword rule + a category_map rule

---

## Success criteria

- All 5 modules present, fully typed, pure (no side effects, no DOM, no Supabase)
- Vitest tests pass; coverage on `lib/finance/**` ≥ 98% lines + branches
- TypeScript strict — `tsc --noEmit` clean
- Lint clean
- Existing tests (100 Vitest + 12 Playwright) still pass
- No imports from `apps/legacy/` (the modules are the new source of truth — they reference legacy code only as a porting reference, not at runtime)

---

## Out of scope

- TanStack Query wiring (2E)
- Surface implementations (2F–2J)
- Type generation from Supabase schema (defer to 2E)
