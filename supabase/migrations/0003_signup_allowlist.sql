-- supabase/migrations/0003_signup_allowlist.sql
-- Even with public signups disabled, harden handle_new_user so that any
-- new auth.users row whose email is not in the allowlist does NOT get
-- joined to the household. Owners maintain the allowlist via SQL.

create table if not exists household_signup_allowlist (
  email text primary key,
  household_id uuid not null references households(id),
  added_by uuid references auth.users(id),
  added_at timestamptz default now()
);

alter table household_signup_allowlist enable row level security;

drop policy if exists "owner manages allowlist" on household_signup_allowlist;
create policy "owner manages allowlist" on household_signup_allowlist
  for all using (is_household_owner(household_id))
  with check (is_household_owner(household_id));

-- Seed Alexis + Marilyn.
-- !!! IMPORTANT: REPLACE marilyn@example.com WITH MARILYN'S ACTUAL EMAIL
-- !!! BEFORE APPLYING THIS MIGRATION.
insert into household_signup_allowlist (email, household_id)
  values ('alexis.hiram@gmail.com', '00000000-0000-0000-0000-000000000001'),
         ('marilyn@example.com',    '00000000-0000-0000-0000-000000000001')
  on conflict (email) do nothing;

-- Rewrite the trigger to enforce the allowlist
create or replace function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
    from household_signup_allowlist
    where lower(email) = lower(new.email);

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
