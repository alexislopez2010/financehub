-- 0023_account_balances_computed_view.sql
--
-- Adds a server-side view that returns one row per account with its
-- computed balance, so the Briefing's Cash / Debt KPIs don't have to
-- iterate the full transactions table client-side.
--
-- Why this is necessary:
--   - PostgREST silently caps row results at 1,000. With >1k transactions
--     in prod, the Briefing's per-account balance math was running over a
--     truncated set and happened to land on the right number by accident
--     (older rows had already shifted out of the window).
--   - The previous balance math also ignored accounts.starting_balance_date,
--     so transactions BEFORE the user set the starting balance were
--     double-counted whenever they survived the 1k truncation.
--
-- The view aggregates per account, applying the date guard:
--   t.date >= starting_balance_date  (or any date when null)
-- and emits the canonical signed-activity math used everywhere else.
--
-- security_invoker = true so RLS on `accounts` and `transactions` still
-- applies as if the caller queried them directly — no privilege escalation.

create or replace view public.account_balances_computed
with (security_invoker = true)
as
with signed as (
  select
    t.account_id,
    sum(
      case
        when t.type = 'Income'   then abs(t.amount)
        when t.type = 'Refund'   then abs(t.amount)
        when t.type = 'Expense'  then -abs(t.amount)
        when t.type = 'Transfer' then t.amount
        else 0
      end
    ) as signed_activity_sum
  from public.transactions t
  join public.accounts a on a.id = t.account_id
  where a.starting_balance_date is null
     or t.date >= a.starting_balance_date
  group by t.account_id
)
select
  a.id              as account_id,
  a.household_id,
  a.name,
  a.type,
  a.owner,
  a.is_active,
  coalesce(a.starting_balance, 0)              as starting_balance,
  a.starting_balance_date,
  coalesce(s.signed_activity_sum, 0)::numeric  as signed_activity,
  -- Cash math (checking/savings/cash): start + signed activity.
  -- Debt math (credit/loan):           start - signed activity (charges raise debt).
  round(
    case
      when a.type in ('checking', 'savings', 'cash')
        then coalesce(a.starting_balance, 0) + coalesce(s.signed_activity_sum, 0)
      when a.type in ('credit', 'loan')
        then coalesce(a.starting_balance, 0) - coalesce(s.signed_activity_sum, 0)
      else coalesce(a.starting_balance, 0)
    end::numeric,
    2
  ) as computed_balance
from public.accounts a
left join signed s on s.account_id = a.id;

comment on view public.account_balances_computed is
  'One row per account with starting balance + signed activity rolled up into a computed_balance. Respects accounts.starting_balance_date so pre-balance-set transactions are excluded. security_invoker=true so the same RLS rules apply as for direct accounts/transactions reads. Use this for any dashboard tile that needs current balances per account so we don''t hit PostgREST''s 1k-row cap.';
