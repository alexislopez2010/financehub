-- supabase/migrations/0006_category_id.sql
-- Phase 1.1 — add transactions.category_id and budgets.category_id as
-- nullable FKs to categories.id. Backfill from the existing text columns.
-- The text columns are NOT dropped here; the legacy app still reads them.
-- Phase 2's cleanup migration drops them post-cutover.

alter table transactions
  add column if not exists category_id uuid references categories(id) on delete set null;

alter table budgets
  add column if not exists category_id uuid references categories(id) on delete set null;

-- Backfill: only the unambiguous cases. Income transactions match
-- categories.type = 'income'; Expense transactions match 'expense'.
-- Transfer and Refund rows are deliberately left null — they are not
-- category-bound semantically and any name collision with an expense
-- category would be a false FK association.
update transactions t
   set category_id = c.id
  from categories c
 where t.category_id is null
   and t.category is not null
   and c.household_id = t.household_id
   and c.name = t.category
   and (
     (t.type = 'Income'  and c.type = 'income')
     or
     (t.type = 'Expense' and c.type = 'expense')
   );

-- Budgets always represent expense categories
update budgets b
   set category_id = c.id
  from categories c
 where b.category_id is null
   and b.category is not null
   and c.household_id = b.household_id
   and c.name = b.category
   and c.type = 'expense';

-- Index the new FK columns for join performance
create index if not exists transactions_category_id_idx
  on transactions(household_id, category_id);
create index if not exists budgets_category_id_idx
  on budgets(household_id, category_id);
