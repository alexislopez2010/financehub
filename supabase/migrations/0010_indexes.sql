-- supabase/migrations/0010_indexes.sql
-- Phase 1.5 — explicit household_id indexes on per-household tables
-- whose only existing indexes are PKs or RLS-helper-irrelevant.

create index if not exists categories_household_idx on categories(household_id);
create index if not exists bills_household_idx on bills(household_id);
create index if not exists family_members_household_idx on family_members(household_id);
create index if not exists accounts_household_idx on accounts(household_id);
