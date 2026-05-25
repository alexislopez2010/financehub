-- supabase/migrations/0014_views_security_invoker.sql
-- Phase 2N T2 — Recreate 9 ERROR-level views without SECURITY DEFINER.
--
-- Migration 0004 already converted the original views (v_monthly_summary,
-- v_category_ytd) to security_invoker. These 9 stragglers were added later
-- (advisor analytics + balance views) and shipped with SECURITY DEFINER,
-- which Supabase advisor flags as ERROR because RLS evaluates as the view
-- creator rather than the caller — silently leaking cross-household rows.
--
-- Pattern mirrors 0004: drop, recreate WITH (security_invoker = true) using
-- the existing definition verbatim, then re-grant.
--
-- Internal dependencies (within the 9-view set):
--   v_account_current_balance        → v_account_running_balance
--   v_advisor_cash_flow_daily        → v_advisor_tx_signed
--   v_advisor_discretionary_vs_fixed → v_advisor_tx_signed
--   v_advisor_spending_by_category   → v_advisor_tx_signed
-- No external views depend on any of these (verified via pg_depend).

-- ---------------------------------------------------------------------------
-- Drop in reverse dependency order so dependents go first. No CASCADE.
-- ---------------------------------------------------------------------------
drop view if exists public.v_account_current_balance;
drop view if exists public.v_advisor_cash_flow_daily;
drop view if exists public.v_advisor_discretionary_vs_fixed;
drop view if exists public.v_advisor_spending_by_category;
drop view if exists public.v_account_running_balance;
drop view if exists public.v_advisor_tx_signed;
drop view if exists public.v_advisor_account_balances;
drop view if exists public.v_advisor_upcoming_obligations;
drop view if exists public.v_category_rule_matches;

-- ---------------------------------------------------------------------------
-- Recreate in forward dependency order, each with security_invoker = true.
-- Bodies are copied verbatim from pg_get_viewdef.
-- ---------------------------------------------------------------------------

-- v_account_running_balance: per-account running balance over time.
create view public.v_account_running_balance
  with (security_invoker = true) as
 WITH daily_deltas AS (
         SELECT t.household_id,
            t.account_id,
            a_1.type AS account_type,
            t.date,
            sum(
                CASE
                    WHEN a_1.type = ANY (ARRAY['credit'::text, 'loan'::text]) THEN
                    CASE t.type
                        WHEN 'Income'::text THEN - t.amount
                        WHEN 'Refund'::text THEN - t.amount
                        WHEN 'Expense'::text THEN t.amount
                        WHEN 'Transfer'::text THEN - t.amount
                        ELSE 0::numeric
                    END
                    ELSE
                    CASE t.type
                        WHEN 'Income'::text THEN t.amount
                        WHEN 'Refund'::text THEN t.amount
                        WHEN 'Expense'::text THEN - t.amount
                        WHEN 'Transfer'::text THEN t.amount
                        ELSE 0::numeric
                    END
                END) AS day_delta
           FROM transactions t
             JOIN accounts a_1 ON a_1.id = t.account_id
          WHERE t.account_id IS NOT NULL
          GROUP BY t.household_id, t.account_id, a_1.type, t.date
        )
 SELECT a.household_id,
    a.id AS account_id,
    a.name AS account_name,
    a.type AS account_type,
    d.date,
    a.starting_balance + sum(d.day_delta) OVER (PARTITION BY a.id ORDER BY d.date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
   FROM daily_deltas d
     JOIN accounts a ON a.id = d.account_id;

-- v_account_current_balance: latest running balance per account.
create view public.v_account_current_balance
  with (security_invoker = true) as
 SELECT DISTINCT ON (account_id) household_id,
    account_id,
    account_name,
    account_type,
    date AS as_of_date,
    running_balance AS current_balance
   FROM v_account_running_balance
  ORDER BY account_id, date DESC;

-- v_advisor_tx_signed: transactions with signed amounts (negative for outflows).
create view public.v_advisor_tx_signed
  with (security_invoker = true) as
 SELECT id,
    household_id,
    date,
    description,
    category,
    sub_category,
    account_id,
    account,
    member,
    payment_method,
        CASE
            WHEN type = 'Expense'::text THEN - abs(amount)
            WHEN type = ANY (ARRAY['Income'::text, 'Refund'::text]) THEN abs(amount)
            WHEN type = 'Transfer'::text THEN amount
            ELSE 0::numeric
        END AS signed_amount,
    type
   FROM transactions t;

-- v_advisor_cash_flow_daily: daily inflow / outflow / net over the last 180 days.
create view public.v_advisor_cash_flow_daily
  with (security_invoker = true) as
 SELECT household_id,
    date,
    sum(
        CASE
            WHEN signed_amount > 0::numeric THEN signed_amount
            ELSE 0::numeric
        END) AS inflow,
    sum(
        CASE
            WHEN signed_amount < 0::numeric THEN - signed_amount
            ELSE 0::numeric
        END) AS outflow,
    sum(signed_amount) AS net
   FROM v_advisor_tx_signed
  WHERE date >= (CURRENT_DATE - '180 days'::interval) AND type <> 'Transfer'::text
  GROUP BY household_id, date;

-- v_advisor_discretionary_vs_fixed: monthly spend split into fixed vs discretionary.
create view public.v_advisor_discretionary_vs_fixed
  with (security_invoker = true) as
 WITH fixed_categories AS (
         SELECT categories.household_id,
            categories.name AS category
           FROM categories
          WHERE categories.is_fixed = true
        UNION
         SELECT bills.household_id,
            bills.category
           FROM bills
          WHERE bills.is_active = true AND bills.category IS NOT NULL
        )
 SELECT t.household_id,
    date_trunc('month'::text, t.date::timestamp with time zone)::date AS month,
        CASE
            WHEN fc.category IS NOT NULL THEN 'fixed'::text
            ELSE 'discretionary'::text
        END AS bucket,
    sum(- t.signed_amount) AS spent
   FROM v_advisor_tx_signed t
     LEFT JOIN fixed_categories fc ON fc.household_id = t.household_id AND fc.category = t.category
  WHERE t.type = 'Expense'::text AND t.date >= (CURRENT_DATE - '6 mons'::interval)
  GROUP BY t.household_id, (date_trunc('month'::text, t.date::timestamp with time zone)::date), (
        CASE
            WHEN fc.category IS NOT NULL THEN 'fixed'::text
            ELSE 'discretionary'::text
        END);

-- v_advisor_spending_by_category: monthly spend per category with priors + trailing avg.
create view public.v_advisor_spending_by_category
  with (security_invoker = true) as
 WITH monthly AS (
         SELECT v_advisor_tx_signed.household_id,
            COALESCE(v_advisor_tx_signed.category, 'Uncategorized'::text) AS category,
            date_trunc('month'::text, v_advisor_tx_signed.date::timestamp with time zone)::date AS month,
            sum(- v_advisor_tx_signed.signed_amount) AS spent
           FROM v_advisor_tx_signed
          WHERE v_advisor_tx_signed.type = 'Expense'::text AND v_advisor_tx_signed.date >= (CURRENT_DATE - '1 year 1 mon'::interval)
          GROUP BY v_advisor_tx_signed.household_id, (COALESCE(v_advisor_tx_signed.category, 'Uncategorized'::text)), (date_trunc('month'::text, v_advisor_tx_signed.date::timestamp with time zone)::date)
        )
 SELECT household_id,
    category,
    month,
    spent,
    lag(spent) OVER (PARTITION BY household_id, category ORDER BY month) AS prior_month,
    avg(spent) OVER (PARTITION BY household_id, category ORDER BY month ROWS BETWEEN 6 PRECEDING AND 1 PRECEDING) AS trailing_6m_avg
   FROM monthly;

-- v_advisor_upcoming_obligations: union of upcoming bill + debt due dates.
create view public.v_advisor_upcoming_obligations
  with (security_invoker = true) as
 WITH bill_occurrences AS (
         SELECT b.household_id,
            b.name,
            b.category,
            b.budget_amount AS amount,
            'bill'::text AS source,
            b.due_day,
            clamp_due_day(b.due_day, CURRENT_DATE) AS due_this_month,
            b.frequency
           FROM bills b
          WHERE b.is_active = true AND b.due_day IS NOT NULL
        ), next_bill_dates AS (
         SELECT bill_occurrences.household_id,
            bill_occurrences.name,
            bill_occurrences.category,
            bill_occurrences.amount,
            bill_occurrences.source,
            bill_occurrences.frequency,
                CASE
                    WHEN bill_occurrences.due_this_month >= CURRENT_DATE THEN bill_occurrences.due_this_month
                    ELSE clamp_due_day(bill_occurrences.due_day, (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon'::interval)::date)
                END AS due_date
           FROM bill_occurrences
        ), debt_obligations AS (
         SELECT d.household_id,
            d.name,
            d.type AS category,
            d.min_payment AS amount,
            'debt'::text AS source,
            'Monthly'::text AS frequency,
                CASE
                    WHEN d.due_day IS NULL THEN CURRENT_DATE + 30
                    WHEN clamp_due_day(d.due_day, CURRENT_DATE) >= CURRENT_DATE THEN clamp_due_day(d.due_day, CURRENT_DATE)
                    ELSE clamp_due_day(d.due_day, (date_trunc('month'::text, CURRENT_DATE::timestamp with time zone) + '1 mon'::interval)::date)
                END AS due_date
           FROM debts d
          WHERE d.is_active = true AND d.min_payment IS NOT NULL AND d.min_payment > 0::numeric AND NOT (EXISTS ( SELECT 1
                   FROM bills b
                  WHERE b.linked_debt_id = d.id AND b.is_active = true))
        )
 SELECT next_bill_dates.household_id,
    next_bill_dates.name,
    next_bill_dates.category,
    next_bill_dates.amount,
    next_bill_dates.source,
    next_bill_dates.frequency,
    next_bill_dates.due_date
   FROM next_bill_dates
UNION ALL
 SELECT debt_obligations.household_id,
    debt_obligations.name,
    debt_obligations.category,
    debt_obligations.amount,
    debt_obligations.source,
    debt_obligations.frequency,
    debt_obligations.due_date
   FROM debt_obligations;

-- v_advisor_account_balances: per-account current balance (alternate path to running balance).
create view public.v_advisor_account_balances
  with (security_invoker = true) as
 WITH signed AS (
         SELECT a.id AS account_id,
            a.household_id,
            a.name,
            a.type,
            a.institution,
            a.starting_balance,
            a.starting_balance_date,
            a.currency,
            a.is_active,
            t.date AS tx_date,
                CASE
                    WHEN a.type = 'credit'::text THEN
                    CASE
                        WHEN t.type = 'Expense'::text THEN abs(t.amount)
                        WHEN t.type = ANY (ARRAY['Income'::text, 'Refund'::text]) THEN - abs(t.amount)
                        WHEN t.type = 'Transfer'::text THEN - t.amount
                        ELSE 0::numeric
                    END
                    ELSE
                    CASE
                        WHEN t.type = 'Expense'::text THEN - abs(t.amount)
                        WHEN t.type = ANY (ARRAY['Income'::text, 'Refund'::text]) THEN abs(t.amount)
                        WHEN t.type = 'Transfer'::text THEN t.amount
                        ELSE 0::numeric
                    END
                END AS signed_amt
           FROM accounts a
             LEFT JOIN transactions t ON t.account_id = a.id
          WHERE a.is_active = true AND a.archived_at IS NULL
        )
 SELECT account_id,
    household_id,
    name AS account_name,
    type AS account_type,
    institution,
    starting_balance + COALESCE(sum(
        CASE
            WHEN tx_date >= COALESCE(starting_balance_date, '1900-01-01'::date) THEN signed_amt
            ELSE 0::numeric
        END), 0::numeric) AS current_balance,
    currency,
    is_active
   FROM signed
  GROUP BY account_id, household_id, name, type, institution, starting_balance, currency, is_active;

-- v_category_rule_matches: best-priority rule match per uncategorized transaction.
create view public.v_category_rule_matches
  with (security_invoker = true) as
 WITH ranked AS (
         SELECT t.id AS transaction_id,
            t.description,
            t.amount,
            t.date,
            r.id AS rule_id,
            r.category,
            r.sub_category,
            r.priority,
            r.pattern,
            r.pattern_type,
            row_number() OVER (PARTITION BY t.id ORDER BY r.priority, r.pattern) AS rk
           FROM transactions t
             JOIN category_rules r ON r.household_id = t.household_id AND r.is_active = true AND (r.pattern_type = 'contains'::text AND upper(t.description) ~~ (('%'::text || upper(r.pattern)) || '%'::text) OR r.pattern_type = 'exact'::text AND upper(t.description) = upper(r.pattern) OR r.pattern_type = 'regex'::text AND t.description ~* r.pattern)
          WHERE t.household_id IS NOT NULL AND (t.category IS NULL OR t.category = 'Uncategorized'::text)
        )
 SELECT transaction_id,
    description,
    amount,
    date,
    rule_id,
    category,
    sub_category,
    priority,
    pattern
   FROM ranked
  WHERE rk = 1;

-- ---------------------------------------------------------------------------
-- Re-grant SELECT. DROP VIEW wipes prior grants. Restoring:
--   * authenticated/anon/service_role/postgres: Supabase defaults (broad)
--   * bill_advisor: the 6 advisor views had an explicit bill_advisor SELECT
--     grant before the recreate; preserve that.
-- ---------------------------------------------------------------------------
grant select on all tables in schema public to authenticated;

grant select on public.v_advisor_tx_signed              to bill_advisor;
grant select on public.v_advisor_cash_flow_daily        to bill_advisor;
grant select on public.v_advisor_discretionary_vs_fixed to bill_advisor;
grant select on public.v_advisor_spending_by_category   to bill_advisor;
grant select on public.v_advisor_upcoming_obligations   to bill_advisor;
grant select on public.v_advisor_account_balances       to bill_advisor;
