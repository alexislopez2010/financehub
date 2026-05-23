-- supabase/migrations/0002_rpcs.sql
-- Version-controls five previously-undocumented RPCs.
-- Each is SECURITY DEFINER with an explicit owner check and a pinned search_path.
--
-- IMPORTANT: explicitly drop old overloads first so the unguarded versions
-- that may exist in production are removed before the new guarded versions
-- are created. Without these drops, create-or-replace would create NEW
-- overloads alongside the old ones and the JSX client (which passes h_id)
-- would still route to the old insecure functions.

drop function if exists claim_lopez_household();
drop function if exists admin_list_household_users(uuid);
drop function if exists admin_list_household_users();
drop function if exists admin_update_household_user(uuid, uuid, text, text);
drop function if exists admin_update_household_user(uuid, text, text);
drop function if exists admin_reset_user_mfa(uuid, uuid);
drop function if exists admin_reset_user_mfa(uuid);
drop function if exists admin_remove_household_user(uuid, uuid);
drop function if exists admin_remove_household_user(uuid);

-- ── claim_lopez_household — no-op for members, hard-fail for non-members ──
-- Called from src/hooks/useFinanceData.js on every load (no args).
create or replace function claim_lopez_household() returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = v_household_id
  ) then
    return;
  end if;

  raise exception 'not authorized: contact a household owner';
end $$;

-- ── admin_list_household_users(h_id uuid) ──
create or replace function admin_list_household_users(h_id uuid)
  returns table (
    user_id uuid,
    email text,
    display_name text,
    role text,
    mfa_factors int,
    joined_at timestamptz
  )
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if h_id <> v_household_id then
    raise exception 'unknown household';
  end if;
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;

  return query
    select hm.user_id,
           u.email::text,
           hm.display_name,
           hm.role,
           (select count(*)::int
              from auth.mfa_factors f
              where f.user_id = hm.user_id and f.status = 'verified'),
           hm.joined_at
    from household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = v_household_id
    order by hm.joined_at;
end $$;

-- ── admin_update_household_user(h_id, target_user, new_role, new_display_name) ──
create or replace function admin_update_household_user(
  h_id uuid,
  target_user uuid,
  new_role text default null,
  new_display_name text default null
) returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if h_id <> v_household_id then
    raise exception 'unknown household';
  end if;
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if new_role is not null and new_role not in ('owner','member') then
    raise exception 'invalid role: %', new_role;
  end if;

  update household_members
     set role = coalesce(new_role, role),
         display_name = coalesce(new_display_name, display_name)
   where user_id = target_user
     and household_id = v_household_id;
end $$;

-- ── admin_reset_user_mfa(h_id, target_user) — returns count of factors removed ──
-- Removes only VERIFIED factors so unverified enrollments-in-progress
-- aren't silently dropped.
create or replace function admin_reset_user_mfa(h_id uuid, target_user uuid)
  returns int
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
  v_count int;
begin
  if h_id <> v_household_id then
    raise exception 'unknown household';
  end if;
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if not exists (
    select 1 from household_members
    where user_id = target_user and household_id = v_household_id
  ) then
    raise exception 'user is not a member of this household';
  end if;

  delete from auth.mfa_factors
    where user_id = target_user and status = 'verified';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ── admin_remove_household_user(h_id, target_user) ──
-- Requires the target to be a 'member' (not 'owner'). Owners must be
-- demoted via admin_update_household_user first. This prevents accidental
-- destruction of an owner row from the admin UI.
create or replace function admin_remove_household_user(h_id uuid, target_user uuid)
  returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
  v_target_role text;
begin
  if h_id <> v_household_id then
    raise exception 'unknown household';
  end if;
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if target_user = auth.uid() then
    raise exception 'owners cannot remove themselves; transfer ownership first';
  end if;

  select role into v_target_role from household_members
    where user_id = target_user and household_id = v_household_id;

  if v_target_role is null then
    raise exception 'user is not a member of this household';
  end if;
  if v_target_role = 'owner' then
    raise exception 'cannot remove an owner directly; demote to member first';
  end if;

  delete from household_members
    where user_id = target_user and household_id = v_household_id;
end $$;

-- ── Lock down direct EXECUTE; only authenticated callers via RPC ──
revoke all on function claim_lopez_household() from public;
revoke all on function admin_list_household_users(uuid) from public;
revoke all on function admin_update_household_user(uuid, uuid, text, text) from public;
revoke all on function admin_reset_user_mfa(uuid, uuid) from public;
revoke all on function admin_remove_household_user(uuid, uuid) from public;

grant execute on function claim_lopez_household() to authenticated;
grant execute on function admin_list_household_users(uuid) to authenticated;
grant execute on function admin_update_household_user(uuid, uuid, text, text) to authenticated;
grant execute on function admin_reset_user_mfa(uuid, uuid) to authenticated;
grant execute on function admin_remove_household_user(uuid, uuid) to authenticated;
