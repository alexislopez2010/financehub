-- supabase/migrations/0013_backfill_category_id.sql
-- Phase 2N.T1 — backfill transactions.category_id from the legacy text
-- column where an unambiguous case-insensitive name match exists in the
-- same household. Migration 0006 only matched rows where the transaction
-- type aligned with the category type (Income/expense); this catches the
-- remaining 53 rows that 0006 left null because the name match alone is
-- sufficient now that the data has been audited.
--
-- Pre-backfill state (verified read-only against live DB):
--   632 transactions; 571 have category_id; 53 have category text but
--   category_id IS NULL. Of those 53:
--     - 11 match a categories row case-insensitively (this migration links them)
--     - 42 have category='Transfer' which is not a category (stays null; correct)
--
-- Idempotent: the `where category_id is null` clause makes re-runs a no-op.

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
