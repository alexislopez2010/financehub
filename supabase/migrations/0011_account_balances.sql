-- supabase/migrations/0011_account_balances.sql
-- Phase 1.6 — table to hold per-account daily balance snapshots.
-- Stays empty in Phase 2; Phase 3 starts populating it via a cron job
-- and a one-time backfill from transaction history.

create table if not exists account_balances (
  account_id uuid references accounts(id) on delete cascade not null,
  household_id uuid references households(id) on delete cascade not null,
  as_of date not null,
  balance numeric(14,2) not null,
  source text not null default 'derived' check (source in ('derived','manual','imported')),
  created_at timestamptz default now(),
  primary key (account_id, as_of)
);

create index if not exists account_balances_household_date_idx
  on account_balances(household_id, as_of desc);

alter table account_balances enable row level security;

drop policy if exists "household read balances" on account_balances;
drop policy if exists "household write balances" on account_balances;
create policy "household read balances" on account_balances
  for select using (is_household_member(household_id));
create policy "household write balances" on account_balances
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
