-- ════════════════════════════════════════════════════════════════════
-- Phase 1: Account Management — Schema Migration
-- Adds starting balances, FK linkage from transactions → accounts,
-- and backfills accounts from existing transaction.account strings.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- 1) Extend accounts table with balance-tracking columns
alter table accounts add column if not exists starting_balance numeric(12,2) default 0;
alter table accounts add column if not exists starting_balance_date date;
alter table accounts add column if not exists currency text default 'USD';
alter table accounts add column if not exists display_order int default 0;
alter table accounts add column if not exists archived_at timestamptz;

-- 2) Add account_id FK to transactions (nullable during transition)
alter table transactions add column if not exists account_id uuid references accounts(id) on delete set null;
create index if not exists transactions_account_id_idx on transactions(household_id, account_id);

-- 3) Backfill: create one accounts row per distinct transactions.account string
--    (per household, skipping nulls/empties). Infer type from common name patterns.
insert into accounts (household_id, name, type, institution, is_active, currency, display_order)
select
  t.household_id,
  t.account as name,
  case
    when lower(t.account) ~ 'credit|card|visa|mastercard|amex|discover' then 'credit'
    when lower(t.account) ~ 'loan|mortgage|auto loan|student' then 'loan'
    when lower(t.account) ~ 'saving|savings|money market|mm|hysa' then 'savings'
    when lower(t.account) ~ 'invest|brokerage|401k|ira|roth|fidelity|vanguard|schwab|etrade' then 'investment'
    else 'checking'
  end as type,
  null as institution,
  true as is_active,
  'USD' as currency,
  0 as display_order
from (
  select distinct household_id, trim(account) as account
  from transactions
  where account is not null and trim(account) <> ''
) t
where not exists (
  select 1 from accounts a
  where a.household_id = t.household_id
    and lower(a.name) = lower(t.account)
);

-- 4) Backfill transactions.account_id from the matching account row (case-insensitive)
update transactions t
set account_id = a.id
from accounts a
where t.account_id is null
  and a.household_id = t.household_id
  and lower(a.name) = lower(trim(t.account));

-- 5) Report how it went (informational)
do $$
declare
  n_accounts int;
  n_linked int;
  n_unlinked int;
begin
  select count(*) into n_accounts from accounts where household_id = '00000000-0000-0000-0000-000000000001';
  select count(*) into n_linked from transactions where household_id = '00000000-0000-0000-0000-000000000001' and account_id is not null;
  select count(*) into n_unlinked from transactions where household_id = '00000000-0000-0000-0000-000000000001' and account_id is null;
  raise notice 'Accounts: %, Linked tx: %, Unlinked tx: %', n_accounts, n_linked, n_unlinked;
end $$;

-- 6) Auto-resolve account_id on new inserts (so Python importer doesn't have to)
create or replace function set_transaction_account_id()
returns trigger
language plpgsql
as $$
begin
  if new.account_id is null and new.account is not null and trim(new.account) <> '' then
    select id into new.account_id
    from accounts
    where household_id = new.household_id
      and lower(name) = lower(trim(new.account))
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_transaction_account_id on transactions;
create trigger trg_set_transaction_account_id
  before insert or update of account on transactions
  for each row execute function set_transaction_account_id();

-- 7) Running balance view: cumulative balance per account per date
--    Uses transaction type: Income/Refund add, Expense subtracts, Transfer handled by sign of amount.
create or replace view v_account_running_balance as
with daily_deltas as (
  select
    t.household_id,
    t.account_id,
    t.date,
    sum(
      case t.type
        when 'Income' then t.amount
        when 'Refund' then t.amount
        when 'Expense' then -t.amount
        when 'Transfer' then t.amount  -- amount sign indicates direction
        else 0
      end
    ) as day_delta
  from transactions t
  where t.account_id is not null
  group by t.household_id, t.account_id, t.date
)
select
  a.household_id,
  a.id as account_id,
  a.name as account_name,
  a.type as account_type,
  d.date,
  a.starting_balance + sum(d.day_delta) over (
    partition by a.id order by d.date
    rows between unbounded preceding and current row
  ) as running_balance
from daily_deltas d
join accounts a on a.id = d.account_id;

-- 8) Current balance per account (latest running balance)
create or replace view v_account_current_balance as
select distinct on (account_id)
  household_id, account_id, account_name, account_type, date as as_of_date, running_balance as current_balance
from v_account_running_balance
order by account_id, date desc;
