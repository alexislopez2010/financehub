# Phase 2N — DB cleanup + advisor remediation

> Subagent-driven; ~3 dispatches.

**Goal:** Real database hygiene before cutover. Investigated against the live DB — turns out two of the originally-planned items can't ship as designed, so this plan replaces them with what's actually cleanable.

**Real findings against the live DB:**
- 632 transactions; 571 linked via `category_id`; **53 still have `category` text but `category_id IS NULL`** (legacy import remnants)
- 50 `type='Transfer'` rows with `transfer_pair_id IS NULL` (legacy single-row transfers from before the pair migration)
- Advisor: **9 ERROR-level findings** (all `security_definer_view` on advisor + balance views from the legacy schema), **83 WARN** (function search_path, PostgREST exposure, leaked password protection)

**Out of original scope (deliberately deferred):**
- ❌ Drop `transactions.category` text column — the **new app** still reads it (display labels in `BudgetSection`, `TransactionRow`, `briefing/notable`, `bills/sort`, `spotlight/search`). Dropping it would break the live app.
- ❌ Backfill 50 legacy single-row transfers — can't infer the destination account programmatically. Leave for manual UI cleanup later.

**What's in scope:**
1. Backfill the 53 `category_id`-missing transactions where the text matches an existing category row
2. Fix the 9 ERROR-level `security_definer_view` advisor findings (recreate as `security invoker`)
3. Fix the 8 `function_search_path_mutable` WARN findings (pin `search_path` on the offenders)
4. Document the deferred items in `supabase/migrations/README.md`

## File structure

```
supabase/
├── migrations/
│   ├── 0013_backfill_category_id.sql        Set category_id from category text where FK match exists
│   ├── 0014_views_security_invoker.sql      Recreate 9 ERROR-level views as security invoker
│   └── 0015_pin_search_path.sql             Pin search_path on 8 remaining functions
└── migrations/README.md                     EDIT — note deferred cleanup (text columns, transfer pairs)
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Migration `0013_backfill_category_id.sql` — `UPDATE transactions SET category_id = c.id FROM categories c WHERE transactions.category_id IS NULL AND lower(transactions.category) = lower(c.name) AND c.household_id = transactions.household_id`. Apply via MCP. Verify 53 → smaller residual; report unmatched count. | `supabase/migrations/0013_backfill_category_id.sql` |
| 2 | Migration `0014_views_security_invoker.sql` — for each of the 9 ERROR views (`v_advisor_discretionary_vs_fixed`, `v_advisor_spending_by_category`, `v_advisor_upcoming_obligations`, `v_account_current_balance`, `v_category_rule_matches`, `v_advisor_cash_flow_daily`, `v_advisor_account_balances`, `v_advisor_tx_signed`, `v_account_running_balance`), recreate with `WITH (security_invoker=true)` if it's a view, OR drop+recreate without SECURITY DEFINER. Apply via MCP. Re-run advisor to confirm count drops by 9. | `supabase/migrations/0014_views_security_invoker.sql` |
| 3 | Migration `0015_pin_search_path.sql` — query `pg_proc` for the 8 offending functions, regenerate each `create or replace function` with `set search_path = public, pg_temp`. Apply via MCP. Re-run advisor. Verify all Vitest tests still green + lint + build. Update `supabase/migrations/README.md` with deferred-cleanup section. Commit close-out. | `supabase/migrations/0015_pin_search_path.sql`, `supabase/migrations/README.md` |

## Detailed task specs

### T1 — `0013_backfill_category_id.sql`

```sql
-- Backfill category_id on transactions where text matches an existing category.
-- Limited to same-household FK linkage. Idempotent.

update transactions t
   set category_id = c.id
  from categories c
 where t.category_id is null
   and t.category is not null
   and t.category <> ''
   and c.household_id = t.household_id
   and lower(c.name) = lower(t.category);

-- Diagnostic: how many remain unmatched?
do $$
declare
  v_remaining int;
begin
  select count(*) into v_remaining
    from transactions
   where category_id is null
     and category is not null
     and category <> '';
  raise notice '0013_backfill_category_id: % rows still unmatched after backfill', v_remaining;
end $$;
```

The implementer should run this and report the residual count. Anything >0 is acceptable; those rows have category text that doesn't match any `categories` row (typos, archived categories). Document in the commit message.

### T2 — `0014_views_security_invoker.sql`

The 9 ERROR views are all defined in the legacy schema (pre-Phase-0). Migration 0004 already converted some views; these are stragglers.

For each view:
1. `DROP VIEW IF EXISTS public.<name>;`
2. Recreate using the existing definition but with `WITH (security_invoker=true)` — OR drop the `SECURITY DEFINER` keyword if it was added to the CREATE VIEW.

The implementer should query `pg_views` to get each view's definition before recreating, e.g.:

```sql
SELECT pg_get_viewdef('public.v_advisor_discretionary_vs_fixed'::regclass, true);
```

Wrap each view's DROP + CREATE in a comment block naming the view, so the migration file is auditable.

If any view's existing definition is broken (e.g. references columns that no longer exist), STOP and report — don't try to fix the view itself, that's beyond cleanup scope.

### T3 — `0015_pin_search_path.sql`

Query for the 8 functions with mutable search_path:

```sql
SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proconfig IS NULL
  AND p.prokind = 'f';
```

For each, alter the function:

```sql
ALTER FUNCTION public.<name>(<args>) SET search_path = public, pg_temp;
```

(`ALTER FUNCTION ... SET` is a cleaner approach than dropping/recreating; it preserves the function body.)

After T1+T2+T3 are all applied, re-run the advisor via MCP and confirm:
- ERROR count: 9 → 0
- WARN count: 83 → ~60-65 (the function_search_path warns drop by 8; the security_definer_function and PostgREST exposure warns are legitimate and stay)

### README update (T3)

Add a "Deferred cleanup" section to `supabase/migrations/README.md`:

```md
## Deferred cleanup (post-cutover)

- **`transactions.category` text + `bills.category` text** — the rewrite still reads these as display labels. Drop only after the new app is fully migrated to `category_id` joins everywhere (out of scope for Phase 2).
- **50 legacy single-row Transfer rows** — `type='Transfer'` with `transfer_pair_id IS NULL`. Inference can't reconstruct the destination account. Surfaced for manual cleanup in the UI.
- **PostgREST anon/authenticated table exposure** (52 lints) — internal advisor views/tables exposed via PostgREST GraphQL. Either disable the GraphQL plugin or move advisor views to a private schema. Defer until needed.
- **`auth_leaked_password_protection`** — Supabase HIBP check disabled by default; toggle in Dashboard → Auth → Passwords. One-click; not code.
```

## Success criteria

- 53 → ≤8 transactions with `category_id IS NULL` and non-blank `category` text (only unmatched typos remain)
- 9 → 0 ERROR-level advisor findings
- 8 → 0 `function_search_path_mutable` WARN findings
- All Vitest tests still green (557+)
- All Playwright anonymous tests still green (12)
- Build green
- README documents deferred work

## Out of scope

- Schema-level column drops (deferred — new app reads them)
- Legacy transfer pair reconstruction (deferred — manual data cleanup)
- PostgREST exposure cleanup (deferred — needs schema strategy)
- Migrating from Vite app (that's 2O)
