-- supabase/migrations/0016_pair_transfer_rows.sql
-- Phase 3C — convert-to-transfer + unpair. Adds two SECURITY DEFINER RPCs
-- that operate on existing transaction rows: pair_transfer_rows links any
-- two opposite-sign rows on different accounts into a Transfer pair (single
-- transaction so you cannot end up half-paired), and unpair_transfer_row
-- reverses the link on both legs (leaving type='Transfer' so the user can
-- edit via the existing EditableCell if desired).
--
-- Auth model: manual is_household_member() gate, matching the pattern in
-- create_transfer (0008). search_path pinned per Phase 2N hygiene.
-- Idempotent: both functions use CREATE OR REPLACE.

create or replace function pair_transfer_rows(
  p_household_id uuid,
  p_row_a_id    uuid,
  p_row_b_id    uuid
) returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_a record;
  v_b record;
begin
  -- Owner check
  if not is_household_member(p_household_id) then
    raise exception 'not authorized';
  end if;

  if p_row_a_id = p_row_b_id then
    raise exception 'cannot pair a row with itself';
  end if;

  -- Load both rows under the household scope (RLS irrelevant in SECURITY DEFINER, we enforce manually)
  select id, household_id, account_id, amount, type, transfer_pair_id, date
    into v_a from transactions where id = p_row_a_id;
  if v_a.id is null then raise exception 'row a not found'; end if;
  if v_a.household_id <> p_household_id then raise exception 'row a is not in this household'; end if;

  select id, household_id, account_id, amount, type, transfer_pair_id, date
    into v_b from transactions where id = p_row_b_id;
  if v_b.id is null then raise exception 'row b not found'; end if;
  if v_b.household_id <> p_household_id then raise exception 'row b is not in this household'; end if;

  -- Validations
  if v_a.account_id is null or v_b.account_id is null then
    raise exception 'both rows must have an account_id';
  end if;
  if v_a.account_id = v_b.account_id then
    raise exception 'rows must be on different accounts';
  end if;
  if abs(v_a.amount) <> abs(v_b.amount) then
    raise exception 'amounts must match in magnitude (% vs %)', v_a.amount, v_b.amount;
  end if;
  if sign(v_a.amount) = sign(v_b.amount) then
    raise exception 'rows must have opposite signs (one inflow, one outflow)';
  end if;
  if v_a.transfer_pair_id is not null or v_b.transfer_pair_id is not null then
    raise exception 'one or both rows are already paired';
  end if;

  -- Pair: use row_a_id as the pair anchor (convention from create_transfer)
  update transactions
    set type = 'Transfer', transfer_pair_id = p_row_a_id
    where id in (p_row_a_id, p_row_b_id);

  return p_row_a_id;
end $$;

revoke all on function pair_transfer_rows(uuid, uuid, uuid) from public;
revoke execute on function pair_transfer_rows(uuid, uuid, uuid) from anon;
grant execute on function pair_transfer_rows(uuid, uuid, uuid) to authenticated;

create or replace function unpair_transfer_row(
  p_household_id uuid,
  p_row_id      uuid
) returns int
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_pair_id uuid;
  v_row_household uuid;
  v_count int;
begin
  if not is_household_member(p_household_id) then
    raise exception 'not authorized';
  end if;

  select household_id, transfer_pair_id into v_row_household, v_pair_id
    from transactions where id = p_row_id;
  if v_row_household is null then raise exception 'row not found'; end if;
  if v_row_household <> p_household_id then raise exception 'row is not in this household'; end if;
  if v_pair_id is null then raise exception 'row is not paired'; end if;

  -- Clear pair_id on both legs. Leave type as-is (caller can edit if they want
  -- to demote back to Expense/Income via the existing EditableCell).
  update transactions
    set transfer_pair_id = null
    where household_id = p_household_id
      and (transfer_pair_id = v_pair_id or id = v_pair_id);
  get diagnostics v_count = row_count;

  return v_count;
end $$;

revoke all on function unpair_transfer_row(uuid, uuid) from public;
revoke execute on function unpair_transfer_row(uuid, uuid) from anon;
grant execute on function unpair_transfer_row(uuid, uuid) to authenticated;
