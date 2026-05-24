-- supabase/migrations/0008_transfer_pairs.sql
-- Phase 1.3 — add the column + RPC. Historical single-row transfers
-- are NOT split here; that backfill runs as part of Phase 2 startup so
-- the legacy Vite app keeps its current view of transfers (single row).

alter table transactions
  add column if not exists transfer_pair_id uuid references transactions(id) on delete set null;

create index if not exists transactions_transfer_pair_idx
  on transactions(household_id, transfer_pair_id)
  where transfer_pair_id is not null;

-- Atomic two-row insert. Both legs share a fresh transfer_pair_id (= the
-- id of the source-leg row) so they can be collapsed in the UI.
create or replace function create_transfer(
  p_household_id    uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            date,
  p_description     text default 'Transfer',
  p_member          text default null
) returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_pair_id uuid;
  v_from_name text;
  v_to_name text;
begin
  if not is_household_member(p_household_id) then
    raise exception 'not authorized';
  end if;
  if p_amount <= 0 then
    raise exception 'transfer amount must be positive';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'source and destination accounts must differ';
  end if;

  select name into v_from_name from accounts
    where id = p_from_account_id and household_id = p_household_id;
  select name into v_to_name from accounts
    where id = p_to_account_id and household_id = p_household_id;
  if v_from_name is null or v_to_name is null then
    raise exception 'invalid account ids for this household';
  end if;

  -- Source leg (debit)
  insert into transactions (
    household_id, date, description, amount, type, account, member
  ) values (
    p_household_id, p_date,
    coalesce(p_description, 'Transfer') || ' → ' || v_to_name,
    -abs(p_amount), 'Transfer', v_from_name, p_member
  )
  returning id into v_pair_id;

  update transactions set transfer_pair_id = v_pair_id where id = v_pair_id;

  -- Destination leg (credit)
  insert into transactions (
    household_id, date, description, amount, type, account, member, transfer_pair_id
  ) values (
    p_household_id, p_date,
    coalesce(p_description, 'Transfer') || ' ← ' || v_from_name,
    abs(p_amount), 'Transfer', v_to_name, p_member, v_pair_id
  );

  return v_pair_id;
end $$;

revoke all on function create_transfer(uuid, uuid, uuid, numeric, date, text, text) from public;
grant execute on function create_transfer(uuid, uuid, uuid, numeric, date, text, text) to authenticated;
