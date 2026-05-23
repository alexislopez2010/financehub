# Financehub — Phase 2 Frontend Rewrite

**Date:** 2026-05-23
**Author:** Alexis (with Claude)
**Status:** Draft for review

## Context

`financehub` is a private React + Vite + Supabase family finance dashboard for the Lopez household (two users: Alexis & Marilyn), deployed on Vercel at `financehub-flame.vercel.app`. The current app has accumulated 10 tabs of functionality in a single 2,738-line `Dashboard.jsx`, no tests, and several latent security and data-integrity issues uncovered by a multi-reviewer audit.

This spec covers **Phase 2** only — the frontend rewrite. Phases 0 (security hotfixes) and 1 (schema migrations) are sequenced before Phase 2 begins and are sketched as an ordered checklist (Section 6). Phases 3 (net-worth over time) and 4 (Claude natural-language layer) get their own design docs later.

## Strategy

**Frontend rewrite, keep Supabase.** The Supabase + RLS + TOTP MFA foundation is production-quality and is preserved. The React app is rebuilt from scratch on Next.js 15.

**Greenfield branch, atomic cutover.** Built on a fresh branch in the existing repo. The current Vite app keeps serving from `main` until parity is reached, then a single merge replaces it. One Vercel project throughout.

## 1. Architecture & app shell

**Stack:** Next.js 15 (App Router, React 19) · TypeScript · Tailwind CSS · TanStack Query · Radix primitives · Supabase JS client · Vercel.

**Why TypeScript:** the JS codebase's commit history is dominated by bug fixes that types would have caught (transfer signs, due-day clamping, income matching). Pays for itself by mid-Phase 2.

**Top-level route layout:**

```
app/
├── (auth)/                  # public auth routes — no app shell
│   ├── login/
│   ├── signup/
│   ├── mfa/                 # enroll + challenge
│   └── reset-password/
├── (app)/                   # everything behind auth, wrapped in shell
│   ├── layout.tsx           # bottom-tab nav, top spotlight bar, profile menu
│   ├── briefing/            # home — the weekly briefing
│   ├── ledger/              # transactions
│   ├── plan/                # budget + income planning
│   ├── bills/               # bills + obligations
│   ├── accounts/            # accounts + debt + (later) net worth
│   └── admin/               # owner-only, behind profile menu
├── api/
│   └── ask/                 # Edge Function for Claude (Phase 4)
└── middleware.ts            # Supabase session + AAL2 enforcement
```

**Server vs Client Components:** app shell, auth gating, layout shells = Server Components. Interactive surfaces (Ledger filtering, Plan editing, charts) = Client Components fetching via TanStack Query.

**Auth model unchanged:** Supabase email/password + TOTP MFA, AAL2 required. The current `App.jsx` switch becomes Next.js middleware that redirects to `/login`, `/mfa`, or `/(app)` based on session state. Closes the password-recovery null-AAL edge case from the security review.

## 2. The 5 surfaces

| Tab | What it replaces | Notes |
|---|---|---|
| **Briefing** | (new) — closest analog is today's "Overview" | Editorial home page. Composition in Section 3. |
| **Ledger** | Transactions tab | Mobile-first sticky-month list, virtualised, bottom-sheet filters on mobile, chip filters on desktop. Inline edit, bulk select, promote-to-bill, sum-of-filtered footer. |
| **Plan** | Budget tab + Income Planning tab | Two sections per month: Income plan vs actual, Expense budget vs actual. Source-keyword matching preserved (extracted to tested pure module). Category renames cascade via the new `category_id` FK. |
| **Bills** | Bills tab + Obligations tab | Sortable by due date / amount / category. Each bill row links to matched transactions. Recurring rules preserved. Due-day server-clamped. |
| **Accounts** | Accounts tab + Debt Calculator tab + CFO tab | Accounts list with balances + Debt calculator + CFO view as in-page sections. Net-worth-over-time (Phase 3) lands here. |

**Spotlight bar** at the top of every tab. Cmd/Ctrl-K opens from anywhere. Three modes:
1. **Find** — fuzzy search across transactions, bills, categories, accounts
2. **Jump** — keyboard nav to any surface
3. **Ask** — Phase 4 dropline; defaults to "find" until the Edge Function exists

**Profile menu** (top-right): Logout, MFA management, theme toggle, Admin (owner-only, server-side checked).

## 3. The Briefing page composition

The home tab. Editorial digest, top-to-bottom:

1. **Spotlight + profile** — search/ask bar with `⌘K` hint, avatar
2. **Masthead** — `VOL. III · BRIEFING · SAT, MAY 23`
3. **Lead headline + standfirst** — one auto-generated sentence (e.g., *"Net worth, up 2.4% this month."*) + a short italic summary
4. **3 KPI stones** — Cash, Debt, This month's net, separated by ruler lines, with delta-from-last-month captions
5. **Coming Due (14 days)** — ledger-style list with dotted leaders, total at top-right
6. **30-day forecast chart** — minimal sparkline, no axes
7. **Notable callouts** — 2-3 algorithmic facts rendered as short paragraphs with bold leads
8. **Bottom tabs** — fixed nav

Lead headline and "Notable" callouts are rule-based templates for Phase 2. Phase 4 swaps them for Claude-generated copy.

**Notable rule set (Phase 2):**
- **Duplicate charge** — same merchant + same amount within 7 days
- **Category swing** — current month spending in a category deviates >15% from trailing 3-month average
- **Slipped bill** — bill due date has passed and no matching transaction within ±3 days
- **New merchant** — first appearance of a merchant in the household's transaction history
- **Income variance** — actual income deviates >10% from planned

Items are ranked by absolute-dollar impact; top 3 win the slot.

## 4. Data layer & state management

Three concerns separated cleanly.

**Server state — TanStack Query.** One query key per data type (`transactions`, `bills`, `budgets`, `accounts`, `categories`, `incomePlan`, `obligations`). Each surface subscribes only to what it needs. Stale-while-revalidate by default. Mutations use optimistic updates with rollback on error. Replaces today's "reload everything on every change" pattern.

**Client state — React.** Filter/sort/selection state stays in the components that own it. No global store. State that needs to outlive a component lives in a small `useContext` provider.

**URL state — Next.js searchParams.** Filters, period selectors, active drill-down (category, account, member) live in the URL. Killed by URL change, not component state. Replaces the fragile `pendingCategoryFilter` prop-drilling. Shareable, back-button-friendly.

**Financial logic — pure modules.** No React inside, fully unit-tested. Each module exports typed functions over plain data — no Supabase dependency, no DOM:

```
lib/finance/
├── forecast.ts          # forecast30Day(transactions, bills, incomePlan, startBalance) → ForecastPoint[]
├── debt.ts              # simulatePayoff(debts, strategy, extraPayment) → PayoffPlan
├── incomeMatching.ts    # matchIncome(incomePlan, transactions) → IncomeMatchResult[]
├── billsMatch.ts        # matchBills(bills, transactions, rules) → BillMatchResult[]
└── dueDate.ts           # clampDay(day, year, month) → number; isDueOn(bill, date) → boolean
```

These are the algorithms the current commit history kept patching. As pure functions, they become the source of truth — the UI just renders their output.

**Bills matching fix:** hardcoded family-specific keyword tables (`anthropic`, `firstenergy`, `tucker`) move to a new Postgres table `bill_match_rules (bill_id, keyword, account_filter)` — editable from Admin. No more code edits to add a bill.

## 5. Design system

**Typography — system sans only.** Same stack as today:

```css
:root {
  --font-system: -apple-system, BlinkMacSystemFont, "Segoe UI",
                 Roboto, "Helvetica Neue", Arial, sans-serif;
}
html, body { font-family: var(--font-system); }
```

No web fonts. Number columns and KPI tickers get `font-variant-numeric: tabular-nums` for column alignment without monospace.

**Color tokens — OKLCH editorial palette:**

```css
:root {
  --color-bg: oklch(97% 0.012 80);          /* warm paper */
  --color-surface: oklch(94% 0.01 80);      /* tinted card */
  --color-ink: oklch(18% 0.005 60);         /* near-black ink */
  --color-muted: oklch(45% 0.005 60);       /* secondary ink */
  --color-rule: oklch(89% 0.01 75);         /* hairline */
  --color-accent: oklch(54% 0.16 145);      /* one green for positive deltas */
  --color-warn: oklch(58% 0.18 30);         /* one red for overspend */
}
```

**Component primitives** in `components/ui/`:
- Editorial chrome: `<Masthead>`, `<Headline>`, `<Standfirst>`, `<SectionLabel>`
- Data primitives: `<KpiStone>`, `<RulerList>`
- Table primitives: `<EditableCell>`, `<SortableHeader>`, `<FilterChip>`

**Radix under the hood** for accessibility-heavy widgets: Dialog (bottom sheet on mobile, modal on desktop), Popover (filter menus), Combobox (account picker), Toast (replaces `alert()`).

**Dark mode** — tokens designed two-themeable, default light. Dark ships post Phase 2.

**Motion** — `prefers-reduced-motion` respected. Charts fade instead of animating, page transitions disabled.

## 6. Pre-rewrite checklist (Phase 0 + Phase 1)

Ordered tasks executed on the current app, before the Phase 2 branch starts.

### Phase 0 — Security hotfixes

1. **`household_members` write policies** — add INSERT/UPDATE/DELETE policies. Only the user can update their own `display_name`; only an `owner` can change `role` or remove members. Closes the privilege-escalation path.
2. **Audit hidden RPCs** — `claim_lopez_household`, `admin_list_household_users`, `admin_update_household_user`, `admin_reset_user_mfa`, `admin_remove_household_user`. Each must be `SECURITY DEFINER` with `SET search_path = public, pg_temp` and an explicit owner guard. Commit definitions to `supabase/rpc.sql`.
3. **Disable open signup** in Supabase dashboard. Invite-only via dashboard for now.
4. **Views with `security_invoker = true`** — recreate `v_monthly_summary` and `v_category_ytd` so RLS applies on view reads.
5. **Password recovery null-AAL fix** — in `App.jsx:33–36`, treat `aalData === null` or any MFA-call error as "MFA required."

### Phase 1 — Schema migrations

6. **`transactions.category_id` FK** + **`budgets.category_id` FK** — add columns, backfill from text columns matching `(household_id, name, type)`, drop text columns. Renames cascade.
7. **`bills.due_day` CHECK** — `CHECK (due_day BETWEEN 1 AND 31)`. App still clamps to month length at query time.
8. **Transfer pairs** — add `transactions.transfer_pair_id uuid references transactions(id)` nullable self-reference. Migration splits each `type='Transfer'` row into a debit/credit pair. New transfers go through an RPC `create_transfer(from_account, to_account, amount, date)` that wraps both inserts in a transaction.
9. **`bill_match_rules` table** — `(id, bill_id fk, keyword text, account_filter text nullable)`. Backfills hardcoded `BILL_TX_MAP` / `BILL_NAME_KW`.
10. **Missing indexes** — explicit `household_id` indexes on `categories`, `bills`, `budgets`, `family_members`.
11. **`account_balances` snapshot table** — created but unused in Phase 2 (Phase 3 will start populating it).

## 7. Testing strategy

**Vitest — `lib/finance/*` modules, target 100% coverage.** Built test-first; the existing implementations are ported across as the reference, with their known bugs fixed in the process. Test files include the exact regressions visible in the commit history (off-by-one in cash-basis forecast, escrow subtraction in debt calc, due-day clamping, source-keyword fuzzy matching).

**Vitest — selective component tests** for components owning non-trivial logic: `EditableCell`, `RulerList` (sum aggregation), Spotlight search (fuzzy match, keyboard nav).

**Playwright — 5 E2E smoke flows** on every CI run, against the deploy preview:
1. Login → MFA challenge → land on Briefing
2. Add a transaction, see it on Briefing's "Notable" if applicable
3. Edit a budget line inline, confirm persistence
4. Promote a transaction to a bill
5. `role='owner'` user opens Admin successfully; `role='member'` user gets a 403 from the admin RPC (server-side enforcement, not just UI hiding)

**pgTAP — schema tests:** RLS isolation between households (member of household A cannot read/write rows in household B) and view security_invoker behavior. Runs against a local Postgres container in CI.

**No snapshot tests.**

**CI gate:** Vitest + Playwright + `tsc --noEmit` + `eslint` must pass on the rewrite branch from day one.

## 8. Error handling

**Three error categories:**

1. **Server-state errors (Supabase fetch / mutate)** — TanStack Query's `isError` + `error`. Section-level inline `<ErrorBlock>` with a "Try again" button. Mutation failures fire a Radix Toast ("Couldn't save bill. Retrying…" → 2 retries → "Save failed"). Replaces today's `alert()`.
2. **Auth / session errors** — middleware redirects to `/login?next=…`. AAL2 downgrade routes to `/mfa` and resumes on success.
3. **Logic errors (impossible state)** — finance modules throw `FinanceError` (discriminated union: `INVALID_DUE_DAY | NEGATIVE_BALANCE | MISSING_CATEGORY | ...`). Typed `ErrorBoundary` catches at the surface boundary; UI shows a one-line cause + "Copy details" for paste-into-issue debugging.

**Loading states** — paper-toned skeleton blocks shaped like the eventual content. No spinners.

**Empty states** — designed, with a single CTA and a "Why am I seeing this?" caption.

**Observability** — Vercel built-in error tracking for client errors. Tiny `/api/log` Edge Function captures `FinanceError` payloads with `household_id` (not PII) for batch debugging. Sentry deferred.

**Named edge cases:**
- **Concurrent edits** — last-write-wins with a toast informing the loser. CRDT layer out of scope.
- **Transfer pair atomicity** — `create_transfer()` RPC wraps both inserts in a Postgres transaction; client can never half-create.
- **Net-worth backfill** — Phase 1 creates `account_balances` even though Phase 2 doesn't write to it.
- **MFA recovery codes** — Supabase doesn't generate them; lost device requires owner reset via admin RPC. Documented in Admin UI copy.

## Open questions / deferred to later phases

- **Phase 3 — Net-worth over time.** Schema (`account_balances`) gets created in Phase 1, but how snapshots are produced (daily cron? mutation-time write-through?) is its own design.
- **Phase 4 — Claude AI layer.** The spotlight bar's "ask" mode is reserved; the Edge Function, prompt design, RLS-aware querying, and streaming UI are a separate spec.
- **Dark mode** — tokens designed for it but not shipped.
- **Multi-currency** — out of scope.
- **Attachments / receipts** — out of scope.
- **Mobile app (PWA / native)** — Phase 2 ships responsive; a real PWA install flow is post-Phase-2.

## Success criteria

Phase 2 ships when:
- All 10 current-app features have parity coverage in the 5 new surfaces.
- 100% coverage on `lib/finance/*` and all 5 Playwright smokes green on `main`.
- Bundle size (gzipped, initial route): under 150 KB JS, under 30 KB CSS.
- LCP under 2.5s, INP under 200ms, CLS under 0.1 on the deployed Briefing route at 3G simulation.
- Pre-rewrite security and schema checklist (Section 6) all merged before the cutover.
- Alexis and Marilyn use the new app for a full month with no critical bugs filed.
