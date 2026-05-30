-- 0017_bills_budget_category.sql
-- Phase 3I T2a — Bridge bills → budget categories.
--
-- Bills currently have a free-text `category` (e.g. "Mortgage/Rent") that
-- doesn't match the real categories taxonomy used by transactions/budgets
-- ("Housing", etc.). Add a nullable FK to categories so each bill can be
-- explicitly mapped to its budget category. AutoCategorize uses this to
-- categorize bill-payment transactions correctly.

alter table public.bills
  add column if not exists budget_category_id uuid
    references public.categories(id) on delete set null;

create index if not exists bills_budget_category_id_idx
  on public.bills(budget_category_id)
  where budget_category_id is not null;

comment on column public.bills.budget_category_id is
  'FK to categories.id — which budget bucket bill payments roll up to. NULL = not mapped (no auto-categorize).';
