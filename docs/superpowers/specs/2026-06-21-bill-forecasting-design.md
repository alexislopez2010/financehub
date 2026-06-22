# Bill Forecasting & Tiered Budget Automation — Design

- **Date:** 2026-06-21
- **Status:** Approved (brainstorming complete) — pending spec review → writing-plans
- **Surface:** New dedicated **Forecast** tab

## Problem

The current forecast (`lib/finance/forecast.ts` → `forecast30Day`) is **flat and short**: each
bill contributes `-budget_amount` on its due date, with no seasonality and a 30-day horizon. A
variable utility like natural gas (high in winter, low in summer) cannot be expressed by a single
`budget_amount`, and there is no way to project spend 6 / 12 / 24 months out or to feed those
projections back into the monthly budget.

The user wants to (1) understand their spending **baseline** through a tiered taxonomy, (2) project
future spend per tier across multiple horizons, seasonal where history allows, and (3) automate
budget adjustment as much as is safe.

## Goals

1. Classify **all** spend into three color-coded tiers and let the user understand each.
2. Project each bill / category forward 6 / 12 / 24 months — seasonal for variable bills, flat for
   fixed obligations, trend-based for discretionary.
3. Propose seasonal-adjusted monthly budgets the user applies with one click (no silent writes).
4. Use as much historical data as the user can provide — beyond ledger depth — to shape projections.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope | **Three-tier taxonomy of all spend**, color-coded: Essential bills · Services & Subscriptions · Discretionary |
| Tier assignment | **Auto-classify with one-click override** |
| Automation level | **Propose + one-click apply, per month** (human in the loop; no auto-write) |
| Surface | **New dedicated Forecast tab** (writes into Plan's budgets but is its own workspace) |
| History beyond ledger | **One-time import, distilled to a compact seasonal profile on the bill; raw rows discarded** |
| AI/ML | **AI at import only** (interpret arbitrary history → profile + explanation; code verifies the numbers); **deterministic everywhere else** |

## The Three Tiers

1. **Essential** (blue) — non-negotiable floor: mortgage, car payment, insurance, and variable
   utilities (gas / electric / water) where seasonality matters.
2. **Services & Subscriptions** (amber) — recurring but cancellable: streaming, gym, AI tools,
   memberships.
3. **Discretionary** (slate) — everything else: variable day-to-day spend that isn't a committed
   obligation.

The tier dimension is finer than the existing `categories.is_fixed` boolean (used by the 50/30/20
view): it splits recurring into Essential vs Services, and separates recurring from Discretionary.

## Architecture

### 1. Schema (additive)

- `categories.tier text` — `'essential' | 'services' | 'discretionary'`, nullable. Default tier for
  spend in that category. Auto-seeded from `is_fixed` + bill linkage.
- `bills.tier text` — same enum, nullable. **Overrides** the category default for a specific bill
  (handles "Netflix and a work-essential tool both live in Software & Apps but are different tiers").
- `bills.seasonal_profile jsonb` — distilled shape:
  `{ baseline: number[12], source: 'import' | 'ledger', years: number, computed_at: string, note: string }`.
  ~12 numbers. `null` ⇒ no seasonality known (project flat). `note` holds the AI's plain-English
  rationale captured at import.

No `bill_amount_history` table — raw history is **not** stored (distill-and-discard).

### 2. Tier classification — `lib/forecast/deriveTier.ts` (pure)

`deriveTier(category, bill)` → auto-guess:
- linked to a bill + `is_fixed` ⇒ **Essential**
- has a bill, not fixed, subscription-like category ⇒ **Services**
- otherwise ⇒ **Discretionary**

Resolution order at read time: `bills.tier` (override) → `categories.tier` (override) →
`deriveTier(...)` (auto). The Forecast surface shows each item's tier with a one-click cycle that
writes `bills.tier` / `categories.tier`.

### 3. Projection engine — `lib/forecast/project.ts` (pure, the heart)

For each bill / category, emit a projected amount per future month across the horizon:

- **Variable bill with `seasonal_profile`** → that month's baseline, blended with recent ledger
  actuals for the same calendar month (recency-weighted) when present.
- **Variable bill, no profile, ledger history present** → calendar-month average from the ledger.
- **Fixed bill** (mortgage, car) → flat `budget_amount` × frequency, on cadence.
- **Discretionary category** → trailing average / simple trend from the ledger.

Every projected number is traceable to its inputs ("Jan ≈ $188, from your 3 imported Januaries
averaged") — required for the approve flow. Few-years handling: 1 year used directly; 2–3 years
recency-weighted; single-month outliers dampened.

Supporting pure modules:
- `rollupByTier.ts` — aggregate per-month projections into the three tiers for the chart + headers.
- `proposeBudgets.ts` — convert next-month projection into `budgets.amount` deltas (proposed vs
  current).

### 4. AI-assisted history import — one-time, distill-and-discard

Server-side Next.js route handler `/api/forecast/analyze-history` (holds the Anthropic key):

1. Accepts an uploaded history file of **any depth** for a chosen bill.
2. Claude **interprets** it: detect the seasonal curve + multi-year trend, flag anomalies (e.g. a
   one-time leak spike) to exclude, identify which rows map to which calendar months. Returns
   **structured/JSON output**.
3. Code **verifies the numbers**: recompute the 12-month baseline deterministically from the
   AI-extracted rows. *AI reads; code counts.* LLM never does the load-bearing arithmetic on money.
4. Returns a verified profile candidate + the AI's plain-English summary for client **preview**.
5. On accept, write `bills.seasonal_profile` and **discard the raw rows**.

Deterministic fallback (calendar-month averaging over whatever was uploaded) keeps the feature alive
if the API is unavailable. Column/format variation across utility exports is absorbed by the AI
interpretation step; the user's gas-file format is confirmed at implementation.

### 5. Forecast surface (new tab)

- **Horizon selector** — 6 / 12 / 24-month segmented control, drives everything below.
- **Projection chart** — stacked area over the horizon, one series per tier; seasonal bumps visible.
- **Three color-coded tiers** — stacked, collapsible, priority order (Essential → Services →
  Discretionary). Tier header shows projected monthly total; rows show per-bill/category detail.
- **Per-bill row** — name, clickable **tier chip** (one-click override), current budget vs projected,
  seasonal-shape sparkline for variable bills, **"Add history"** affordance when no profile exists.
- **Propose-and-apply panel** — upcoming month(s): proposed budget per category vs current, with
  per-row and bulk **Apply** writing to `budgets`.
- Color-coding is consistent across tier chip, chart series, and row accent.

## Data Flow

- **Reads:** bills (+ tier + seasonal_profile), categories (+ tier), transactions (live ledger),
  budgets (current).
- **Pure transforms:** `deriveTier` → `project` → `rollupByTier` / `proposeBudgets`.
- **Writes:** `bills.tier` / `categories.tier` (override), `bills.seasonal_profile` (import),
  `budgets.amount` (apply).
- **AI:** `/api/forecast/analyze-history` (server) → Claude structured output → code verification →
  client preview → save.

## Decomposition (build order)

Each phase ships value independently and gets its own implementation plan + review.

- **Phase 1 — Taxonomy + projection engine** (no AI, no surface): schema, `deriveTier`, `project`,
  `rollupByTier`, `proposeBudgets`, deterministic projection from ledger + manual profile. Pure
  modules + tests. Delivers 3-tier projections at ledger depth.
- **Phase 2 — Forecast surface**: the new tab rendering Phase 1's data — tiers, horizon, chart, tier
  override, propose-and-apply to budgets.
- **Phase 3 — AI history import**: the wizard + `/api/forecast/analyze-history` + Claude integration
  + verification + distill-to-profile, deepening projections beyond ledger.

## Testing

- Pure modules (`project`, `deriveTier`, `rollupByTier`, `proposeBudgets`, profile-from-rows
  verification) carry the load at the `lib/finance` 98% coverage bar.
- AI import: test the deterministic verification + fallback paths with fixtures; mock the Claude call.
- Surface: component tests where they fire; responsive verification at 320 / 375 / 768 / 1024 / 1440
  per the web testing rules.

## To Confirm At Implementation

- The gas-file format (CSV vs the utility's native export). The AI interpretation + column-mapping
  step is designed to absorb this; we confirm specifics when wiring Phase 3.
- Anthropic model + structured-output shape for the import route — to be pinned via the `claude-api`
  reference during Phase 3 implementation.

## Out of Scope (YAGNI)

- A stored `bill_amount_history` table (explicitly dropped — distill-and-discard).
- Auto-sync budget writes (rejected — propose-and-apply only).
- Trained ML models / continuous LLM re-forecasting (rejected — overkill, non-deterministic,
  breaks traceability).
- A live "ask your forecast" assistant (deferred; AI is import-only for now).
