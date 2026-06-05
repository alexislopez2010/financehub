-- 0024_accounts_type_check_add_mortgage_property.sql
--
-- Extends the accounts.type CHECK constraint to recognize the new buckets
-- introduced by commit 6cdf3d4 (Property/Mortgage in Briefing KPI math) and
-- e6c826a (Property/Mortgage in the Accounts UI dropdown). Previously the
-- constraint only allowed {checking, savings, credit, loan, investment},
-- so attempts to create a Mortgage or Property account were silently
-- rejected by the DB.
--
-- New types:
--   'cash'     — physical cash / wallet, behaves like checking for math.
--   'mortgage' — debt secured against real estate; debt-math (like loan).
--   'property' — real estate asset; cash-math, illiquid.
--   'asset'    — generic illiquid asset (vehicle, jewelry, etc.).

alter table public.accounts
  drop constraint if exists accounts_type_check;

alter table public.accounts
  add constraint accounts_type_check
  check (type = any (array[
    'checking'::text,
    'savings'::text,
    'cash'::text,
    'credit'::text,
    'loan'::text,
    'mortgage'::text,
    'investment'::text,
    'property'::text,
    'asset'::text
  ]));
