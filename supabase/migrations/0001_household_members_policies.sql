-- supabase/migrations/0001_household_members_policies.sql
-- Closes CRITICAL: missing INSERT/UPDATE/DELETE policies on household_members
-- enabled silent privilege escalation. After this migration:
--   * No direct INSERT from clients — only via on_auth_user_created trigger (definer).
--   * UPDATE: a user can update their own row, an owner can update any row.
--   * Changing role requires owner; changing user_id/household_id is forbidden.
--   * DELETE: owner only, and an owner cannot delete themselves.

-- ── helper: is_household_owner() ──────────────────────────────────────
create or replace function is_household_owner(h_id uuid) returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid()
      and household_id = h_id
      and role = 'owner'
  );
$$;

-- ── policies ──────────────────────────────────────────────────────────
drop policy if exists "view own memberships" on household_members;
drop policy if exists "no direct membership insert" on household_members;
drop policy if exists "update self or owner" on household_members;
drop policy if exists "owner deletes member" on household_members;

create policy "view own memberships" on household_members
  for select
  using (user_id = auth.uid() or is_household_member(household_id));

create policy "no direct membership insert" on household_members
  for insert
  with check (false);

create policy "update self or owner" on household_members
  for update
  using (user_id = auth.uid() or is_household_owner(household_id))
  with check (user_id = auth.uid() or is_household_owner(household_id));

create policy "owner deletes member" on household_members
  for delete
  using (is_household_owner(household_id) and user_id <> auth.uid());

-- ── trigger: forbid changing user_id or household_id; non-owners cannot change role ──
create or replace function household_members_update_guard() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
begin
  if old.household_id <> new.household_id then
    raise exception 'household_id is immutable';
  end if;
  if old.user_id <> new.user_id then
    raise exception 'user_id is immutable';
  end if;
  if old.role <> new.role and not is_household_owner(old.household_id) then
    raise exception 'only an owner can change member role';
  end if;
  return new;
end $$;

drop trigger if exists household_members_update_guard on household_members;
create trigger household_members_update_guard
  before update on household_members
  for each row execute function household_members_update_guard();
