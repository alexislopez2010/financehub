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
  year int not null,
  month int not null check (month between 1 and 12),
  amount numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  unique (household_id, category, year, month)
);

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
language sql security definer stable as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = h_id
  );
$$;

-- Households policies
drop policy if exists "view own households" on households;
create policy "view own households" on households for select using (is_household_member(id));

-- household_members policies
drop policy if exists "view own memberships" on household_members;
create policy "view own memberships" on household_members for select using (user_id = auth.uid() or is_household_member(household_id));

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

-- ════════════════════════════════════════════════════════════════════
-- AUTO-ADD NEW USERS TO THE LOPEZ HOUSEHOLD
-- (Replace the household_id below with your actual household id if you recreate it)
-- ════════════════════════════════════════════════════════════════════

create or replace function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into household_members (user_id, household_id, display_name, role)
  values (
    new.id,
    '00000000-0000-0000-0000-000000000001',
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when (select count(*) from household_members where household_id = '00000000-0000-0000-0000-000000000001') = 0
         then 'owner' else 'member' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- HELPFUL VIEWS for the dashboard
-- ════════════════════════════════════════════════════════════════════

create or replace view v_monthly_summary as
select
  household_id,
  date_trunc('month', date)::date as month,
  sum(case when type = 'Income' then amount else 0 end) as income,
  sum(case when type = 'Expense' then amount else 0 end) as expenses,
  sum(case when type = 'Refund' then amount else 0 end) as refunds,
  sum(case when type = 'Income' then amount else 0 end)
    - sum(case when type = 'Expense' then amount else 0 end)
    + sum(case when type = 'Refund' then amount else 0 end) as net_cash_flow,
  count(*) filter (where type = 'Expense') as expense_count,
  count(*) filter (where type = 'Income') as income_count
from transactions
group by household_id, date_trunc('month', date);

create or replace view v_category_ytd as
select
  household_id,
  extract(year from date)::int as year,
  category,
  type,
  sum(amount) as total,
  count(*) as txn_count
from transactions
where category is not null
group by household_id, extract(year from date), category, type;
