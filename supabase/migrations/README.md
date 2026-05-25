# Supabase migrations

Numeric-prefixed SQL files in this directory are applied **in lexical order**.
The existing `supabase/schema.sql` is the canonical fresh-install schema; it
is updated to reflect the rolled-up state after every migration here.

Migration files (`0001_…`, `0002_…`, etc.) are added by later tasks in the
pre-rewrite plan (`docs/superpowers/plans/2026-05-23-financehub-pre-rewrite.md`).
This README is the runbook for applying them once they exist.

## How to apply

All commands run from the repo root.

**Staging (preview branch):**

    cd "$(git rev-parse --show-toplevel)"
    source ~/.config/financehub/staging.env   # set up in the plan's Prerequisites step
    psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_household_members_policies.sql

**Production:** apply via the Supabase SQL Editor (paste, Run). The SQL Editor
halts on the first error by default — the same safety guarantee as
`ON_ERROR_STOP=1`. Always apply to staging first, smoke-test, then prod.
Never edit a migration file after it has run in production — write a new
file instead.

## File naming

    NNNN_short_description.sql

Where NNNN is a four-digit zero-padded ordinal. Files are NOT timestamped
so the order is unambiguous and renames stay impossible.

## Deferred cleanup (post-cutover)

Items intentionally deferred from Phase 2N. Revisit after cutover when the
new app is the sole consumer:

- **`transactions.category` text + `bills.category` text** — the new app
  still reads these as display labels (BudgetSection, TransactionRow,
  briefing/notable, bills/sort, spotlight/search). Drop only after
  migrating every consumer to `category_id` joins.
- **50 legacy single-row Transfer rows** — `type='Transfer'` with
  `transfer_pair_id IS NULL`. Inference can't reconstruct the destination
  account. Surfaced for manual cleanup via the new app's UI.
- **PostgREST anon/authenticated table exposure** (52 WARN findings —
  `pg_graphql_anon_table_exposed`, `pg_graphql_authenticated_table_exposed`)
   — internal advisor views/tables exposed via PostgREST GraphQL. Disable
  the GraphQL plugin in Supabase Dashboard, OR move advisor views to a
  private schema. Defer until needed.
- **`auth_leaked_password_protection`** (1 WARN) — Supabase HIBP check
  disabled by default; toggle in Dashboard → Auth → Passwords. One-click;
  not code.
- **Remaining `security_definer_function_executable` WARNs** (22 — split
  15 authenticated + 7 anon) — admin RPCs and helpers grant EXECUTE to
  anon/authenticated. These are owner-gated internally and the gate is
  the right defense, but the Supabase advisor still flags them. Either
  narrow the GRANTs further (revoke from anon at minimum — some already
  are) or accept as a known design choice.
