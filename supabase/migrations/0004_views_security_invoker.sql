-- supabase/migrations/0004_views_security_invoker.sql
-- Postgres 15+ supports WITH (security_invoker = true) on views so RLS
-- evaluates as the caller, not the view owner. Without this, views over
-- RLS-protected tables silently leak cross-household data.

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
