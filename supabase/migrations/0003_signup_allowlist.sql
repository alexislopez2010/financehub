-- supabase/migrations/0003_signup_allowlist.sql
-- Even with public signups disabled, harden handle_new_user so that any
-- new auth.users row whose email is not in the allowlist does NOT get
-- joined to the household. Owners maintain the allowlist via SQL.

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

-- Seed Alexis only. Marilyn's address can be added later with a one-line INSERT:
--   insert into household_signup_allowlist (email, household_id)
--     values ('<her-email>', '00000000-0000-0000-0000-000000000001');
insert into household_signup_allowlist (email, household_id)
  values ('alexis.hiram@gmail.com', '00000000-0000-0000-0000-000000000001')
  on conflict (email) do nothing;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
