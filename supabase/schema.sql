-- ════════════════════════════════════════════════════════════════════
-- Lopez Family Finances — Supabase Schema
-- Run this in the Supabase SQL Editor after creating your project.
-- ════════════════════════════════════════════════════════════════════

-- ── HOUSEHOLD ──
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Seed one household for the Lopez family
insert into households (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Lopez Family')
on conflict (id) do nothing;

-- ── HOUSEHOLD MEMBERSHIP ──
-- Links auth.users to a household. Add your accounts here after signup.
create table if not exists household_members (
  user_id uuid references auth.users(id) on delete cascade,
  household_id uuid references households(id) on delete cascade,
  display_name text,
  role text default 'member' check (role in ('owner','member')),
  joined_at timestamptz default now(),
  primary key (user_id, household_id)
);

-- ── ACCOUNTS (bank/card accounts) ──
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  type text check (type in ('checking','savings','credit','loan','investment')),
  institution text,
  last_four text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ── CATEGORIES ──
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('expense','income')),
  parent_category text,
  is_fixed boolean default false,
  created_at timestamptz default now(),
  unique (household_id, name, type)
);

-- ── FAMILY MEMBERS (people, not auth users — e.g., Alex Jr, Marilyn's kid) ──
create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  relationship text,
  created_at timestamptz default now()
);

-- ── TRANSACTIONS ──
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  date date not null,
  description text not null,
  amount numeric(12,2) not null,
  type text not null check (type in ('Expense','Income','Transfer','Refund')),
  category text,
  category_id uuid references categories(id) on delete set null,
  account text,
  member text,
  payment_method text,
  notes text,
  fingerprint text,
  imported_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists transactions_household_date_idx on transactions(household_id, date desc);
create index if not exists transactions_category_idx on transactions(household_id, category);
create index if not exists transactions_account_idx on transactions(household_id, account);
create index if not exists transactions_fingerprint_idx on transactions(household_id, fingerprint);
create index if not exists transactions_category_id_idx on transactions(household_id, category_id);

-- ── BILLS (recurring) ──
create table if not exists bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  name text not null,
  category text,
  account text,
  due_day int,
  frequency text check (frequency in ('Monthly','Biweekly','Weekly','Quarterly','Annual')),
  budget_amount numeric(12,2) not null default 0,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now()
);

-- ── BUDGETS (by category + month) ──
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  category text not null,
  category_id uuid references categories(id) on delete set null,
  year int not null,
  month int not null check (month between 1 and 12),
  amount numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  unique (household_id, category, year, month)
);

create index if not exists budgets_category_id_idx on budgets(household_id, category_id);

-- ════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- Users can only see data for households they belong to.
-- ════════════════════════════════════════════════════════════════════

alter table households enable row level security;
alter table household_members enable row level security;
alter table accounts enable row level security;
alter table categories enable row level security;
alter table family_members enable row level security;
alter table transactions enable row level security;
alter table bills enable row level security;
alter table budgets enable row level security;

-- Helper function: does the current user belong to this household?
create or replace function is_household_member(h_id uuid) returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = h_id
  );
$$;

-- Households policies
drop policy if exists "view own households" on households;
create policy "view own households" on households for select using (is_household_member(id));

-- Generic policy for all per-household tables
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','family_members','transactions','bills','budgets']
  loop
    execute format('drop policy if exists "household read" on %I', t);
    execute format('drop policy if exists "household write" on %I', t);
    execute format('create policy "household read" on %I for select using (is_household_member(household_id))', t);
    execute format('create policy "household write" on %I for all using (is_household_member(household_id)) with check (is_household_member(household_id))', t);
  end loop;
end $$;

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
create policy "view own memberships" on household_members
  for select
  using (user_id = auth.uid() or is_household_member(household_id));

drop policy if exists "no direct membership insert" on household_members;
create policy "no direct membership insert" on household_members
  for insert
  with check (false);

drop policy if exists "update self or owner" on household_members;
create policy "update self or owner" on household_members
  for update
  using (user_id = auth.uid() or is_household_owner(household_id))
  with check (user_id = auth.uid() or is_household_owner(household_id));

drop policy if exists "owner deletes member" on household_members;
create policy "owner deletes member" on household_members
  for delete
  using (is_household_owner(household_id) and user_id <> auth.uid());

-- ── trigger: forbid changing user_id or household_id; non-owners cannot change role;
--    last owner cannot demote themselves ──
create or replace function household_members_update_guard() returns trigger
  language plpgsql
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
  if old.role = 'owner' and new.role <> 'owner' then
    if not exists (
      select 1 from household_members
      where household_id = old.household_id
        and role = 'owner'
        and user_id <> old.user_id
    ) then
      raise exception 'cannot demote the last owner of a household';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists household_members_update_guard on household_members;
create trigger household_members_update_guard
  before update on household_members
  for each row execute function household_members_update_guard();

-- ════════════════════════════════════════════════════════════════════
-- HELPFUL VIEWS for the dashboard
-- ════════════════════════════════════════════════════════════════════

drop view if exists v_monthly_summary;
create view v_monthly_summary
  with (security_invoker = true) as
select
  household_id,
  date_trunc('month', date)::date as month,
  sum(case when type = 'Income'  then amount else 0 end) as income,
  sum(case when type = 'Expense' then amount else 0 end) as expenses,
  sum(case when type = 'Refund'  then amount else 0 end) as refunds,
  sum(case when type = 'Income'  then amount else 0 end)
    - sum(case when type = 'Expense' then amount else 0 end)
    + sum(case when type = 'Refund'  then amount else 0 end) as net_cash_flow,
  count(*) filter (where type = 'Expense') as expense_count,
  count(*) filter (where type = 'Income')  as income_count
from transactions
group by household_id, date_trunc('month', date);

drop view if exists v_category_ytd;
create view v_category_ytd
  with (security_invoker = true) as
select
  household_id,
  extract(year from date)::int as year,
  category,
  type,
  sum(amount) as total,
  count(*)    as txn_count
from transactions
where category is not null
group by household_id, extract(year from date), category, type;

-- Re-grant SELECT on the views to authenticated (Supabase client role).
-- DROP VIEW above wipes prior grants; without these the dashboard would
-- silently return empty data when querying through PostgREST.
grant select on v_monthly_summary to authenticated;
grant select on v_category_ytd to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- RPCs (migration 0002)
-- Version-controls five previously-undocumented RPCs.
-- Each is SECURITY DEFINER with an explicit owner check and a pinned search_path.
-- ════════════════════════════════════════════════════════════════════

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

-- ════════════════════════════════════════════════════════════════════
-- SIGNUP ALLOWLIST + HARDENED handle_new_user (migration 0003)
-- Public signups are disabled in the Supabase dashboard.
-- The trigger below also enforces the allowlist at the DB level.
-- ════════════════════════════════════════════════════════════════════

-- Seed data lives in supabase/migrations/0003_signup_allowlist.sql, not here.
create table if not exists household_signup_allowlist (
  email text primary key,
  household_id uuid not null references households(id),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz default now()
);

-- Normalize email to lowercase on insert/update so the case-sensitive
-- text PK is effectively case-insensitive. Without this, two rows
-- ('foo@x.com', 'FOO@x.com') could coexist and the handle_new_user
-- lookup would be non-deterministic.
create or replace function household_signup_allowlist_normalize() returns trigger
  language plpgsql
  set search_path = public, pg_temp
as $$
begin
  if new.email is not null then
    new.email := lower(new.email);
  end if;
  return new;
end $$;

drop trigger if exists household_signup_allowlist_normalize on household_signup_allowlist;
create trigger household_signup_allowlist_normalize
  before insert or update on household_signup_allowlist
  for each row execute function household_signup_allowlist_normalize();

alter table household_signup_allowlist enable row level security;

drop policy if exists "owner manages allowlist" on household_signup_allowlist;
drop policy if exists "owner reads allowlist" on household_signup_allowlist;
drop policy if exists "owner writes allowlist" on household_signup_allowlist;

create policy "owner reads allowlist" on household_signup_allowlist
  for select
  using (is_household_owner(household_id));

create policy "owner writes allowlist" on household_signup_allowlist
  for all
  using (is_household_owner(household_id))
  with check (is_household_owner(household_id));

-- Rewrite the trigger to enforce the allowlist
create or replace function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid;
begin
  -- Phone-auth and SSO users may have null email; they cannot match
  -- an email allowlist, so skip the join attempt cleanly.
  if new.email is null then
    return new;
  end if;

  select household_id into v_household_id
    from household_signup_allowlist
    where email = lower(new.email);

  if v_household_id is null then
    -- Not allowlisted. Leave the auth.users row alone — no household join.
    return new;
  end if;

  insert into household_members (user_id, household_id, display_name, role)
    values (
      new.id,
      v_household_id,
      coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
      case
        when (select count(*) from household_members where household_id = v_household_id) = 0
        then 'owner' else 'member'
      end
    );
  return new;
end $$;

-- Trigger itself is unchanged but recreate defensively
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
