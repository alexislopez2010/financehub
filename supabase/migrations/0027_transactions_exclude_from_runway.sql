-- 0027_transactions_exclude_from_runway.sql
-- Phase 3L — let the user flag individual transactions as "one-off / planned
-- discretionary" so the Cash Runway denominator reflects only recurring burn.
-- The flag does NOT affect YTD Expense, YTD Net, or any non-runway surface
-- — those still treat the spend as real (because it is). It only changes
-- what feeds the avgMonthlyExpense used to project months of runway.
--
-- Default false; backwards compatible with every existing row.

alter table transactions
  add column if not exists exclude_from_runway boolean not null default false;

-- Partial index so the typical "list everything not excluded" predicate
-- the CFO calc uses is fast even at large transaction counts.
create index if not exists transactions_exclude_from_runway_idx
  on transactions (account_id, date)
  where exclude_from_runway = false;
