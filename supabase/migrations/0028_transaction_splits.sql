-- 0028_transaction_splits.sql
-- Phase 3M — split one transaction across multiple categories and/or members.
-- The parent transaction stays as the bank-import audit record. Splits are
-- pure metadata: each is a (member, category, amount) share of the parent.
-- Surfaces that aggregate by category/member iterate splits when present.
--
-- Invariant: sum of split.amount per transaction MUST equal parent.amount.
-- Enforced via trigger so DB-level edits stay consistent.

create table if not exists transaction_splits (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  transaction_id   uuid not null references transactions(id) on delete cascade,
  amount           numeric not null check (amount > 0),
  member           text,
  category         text,
  category_id      uuid references categories(id) on delete set null,
  sub_category     text,
  notes            text,
  /** Per-split override of parent.exclude_from_runway. NULL inherits from parent. */
  exclude_from_runway boolean,
  display_order    int not null default 0,
  created_at       timestamptz default now()
);

create index if not exists transaction_splits_transaction_id_idx
  on transaction_splits (transaction_id);
create index if not exists transaction_splits_household_idx
  on transaction_splits (household_id, transaction_id);
create index if not exists transaction_splits_category_id_idx
  on transaction_splits (category_id)
  where category_id is not null;

alter table transaction_splits enable row level security;

drop policy if exists "household read transaction splits" on transaction_splits;
drop policy if exists "household write transaction splits" on transaction_splits;

create policy "household read transaction splits" on transaction_splits
  for select using (is_household_member(household_id));
create policy "household write transaction splits" on transaction_splits
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Invariant check: sum of splits for a transaction must equal the parent's
-- |amount|. Trigger runs after any insert/update/delete on splits and raises
-- if the invariant is broken. Allows transient zero (no splits = inherit
-- parent, which is the default state when no rows exist).
create or replace function tg_check_split_sum() returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
declare
  v_tx_id        uuid;
  v_parent_amt   numeric;
  v_splits_sum   numeric;
begin
  v_tx_id := coalesce(new.transaction_id, old.transaction_id);

  select abs(amount) into v_parent_amt from transactions where id = v_tx_id;
  if v_parent_amt is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0) into v_splits_sum
    from transaction_splits where transaction_id = v_tx_id;

  -- Allow no splits (zero) — that's the "not split" state.
  if v_splits_sum = 0 then
    return coalesce(new, old);
  end if;

  -- Tolerance for floating-point: 1 cent.
  if abs(v_splits_sum - v_parent_amt) > 0.01 then
    raise exception
      'Transaction split sum (%) must equal parent absolute amount (%)',
      v_splits_sum, v_parent_amt;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists tg_transaction_splits_check_sum on transaction_splits;
create constraint trigger tg_transaction_splits_check_sum
  after insert or update or delete on transaction_splits
  deferrable initially deferred
  for each row execute function tg_check_split_sum();
