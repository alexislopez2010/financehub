-- supabase/migrations/0002_rpcs.sql
-- Version-controls five previously-undocumented RPCs.
-- Each is SECURITY DEFINER with an explicit owner check and a pinned search_path.

-- ── claim_lopez_household — gated, owner-only ──
-- Called from src/hooks/useFinanceData.js on every load. Tightened so it
-- no longer silently joins arbitrary users into the household.
create or replace function claim_lopez_household() returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- Idempotent: if the caller is already a member, no-op.
  if exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = v_household_id
  ) then
    return;
  end if;

  -- Otherwise refuse. Membership is granted only by handle_new_user
  -- (signup trigger) or by an owner via admin_update_household_user.
  raise exception 'not authorized: contact a household owner';
end $$;

-- ── admin_list_household_users ──
create or replace function admin_list_household_users()
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

-- ── admin_update_household_user(target_user uuid, new_role text, new_display_name text) ──
create or replace function admin_update_household_user(
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

-- ── admin_reset_user_mfa(target_user uuid) — wipe verified TOTP factors ──
create or replace function admin_reset_user_mfa(target_user uuid)
  returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if not exists (
    select 1 from household_members
    where user_id = target_user and household_id = v_household_id
  ) then
    raise exception 'user is not a member of this household';
  end if;

  delete from auth.mfa_factors where user_id = target_user;
end $$;

-- ── admin_remove_household_user(target_user uuid) ──
create or replace function admin_remove_household_user(target_user uuid)
  returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if target_user = auth.uid() then
    raise exception 'owners cannot remove themselves; transfer ownership first';
  end if;

  delete from household_members
    where user_id = target_user and household_id = v_household_id;
end $$;

-- ── Lock down direct EXECUTE; only authenticated callers via RPC ──
revoke all on function claim_lopez_household() from public;
revoke all on function admin_list_household_users() from public;
revoke all on function admin_update_household_user(uuid, text, text) from public;
revoke all on function admin_reset_user_mfa(uuid) from public;
revoke all on function admin_remove_household_user(uuid) from public;

grant execute on function claim_lopez_household() to authenticated;
grant execute on function admin_list_household_users() to authenticated;
grant execute on function admin_update_household_user(uuid, text, text) to authenticated;
grant execute on function admin_reset_user_mfa(uuid) to authenticated;
grant execute on function admin_remove_household_user(uuid) to authenticated;
