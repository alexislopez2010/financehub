-- supabase/migrations/0007_due_day_check.sql
-- Phase 1.2 — enforce 1 ≤ due_day ≤ 31 at the schema level.
-- App code is still responsible for clamping to actual month length
-- (e.g. day=31 on Feb → 28/29), but no row can ever store 0 or 32+.
-- NULL is allowed for bills with no scheduled day.

-- Defensive backfill in case any out-of-range rows exist
update bills set due_day = least(greatest(due_day, 1), 31)
  where due_day is not null and (due_day < 1 or due_day > 31);

alter table bills
  add constraint bills_due_day_range check (due_day is null or (due_day between 1 and 31));
