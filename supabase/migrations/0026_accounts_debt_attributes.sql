-- 0026_accounts_debt_attributes.sql
-- Phase 3K — move debt metadata (APR, min payment, due day, original balance)
-- onto the accounts table so the Debt surface can pull a single source of
-- truth for credit/loan/mortgage accounts. The debts table stays as the
-- backing store for non-account-linked liabilities (e.g., student loans
-- with no individual account).
--
-- All columns are nullable + additive; no breakage to existing rows.

alter table accounts
  add column if not exists apr               numeric,
  add column if not exists min_payment       numeric,
  add column if not exists due_day           integer,
  add column if not exists original_balance  numeric;

alter table accounts
  drop constraint if exists accounts_due_day_check;
alter table accounts
  add constraint accounts_due_day_check
  check (due_day is null or (due_day between 1 and 31));

alter table accounts
  drop constraint if exists accounts_apr_check;
alter table accounts
  add constraint accounts_apr_check
  check (apr is null or apr >= 0);

alter table accounts
  drop constraint if exists accounts_min_payment_check;
alter table accounts
  add constraint accounts_min_payment_check
  check (min_payment is null or min_payment >= 0);
