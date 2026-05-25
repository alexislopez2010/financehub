-- supabase/tests/02_transactions_rls.sql
-- Phase 2M.T1 — RLS coverage for every per-household data table:
--   transactions, bills, categories, accounts, budgets,
--   income_plan, bill_match_rules.
--
-- For each table, three assertions:
--   1. A member can SELECT a fixture row in the Lopez household.
--   2. A synthetic non-member sees zero rows from the table.
--   3. Anon cannot SELECT the table (helper EXECUTE revoked → 42501).
--
-- Plus two cross-cutting INSERT assertions:
--   A. A member CAN insert a row with household_id = Lopez.
--   B. A non-member CANNOT insert (WITH CHECK fails → 42501).
--
-- Fixtures are inserted by the `postgres` superuser inside the
-- transaction, then asserted against under the `authenticated` role.
-- Everything rolls back at end-of-file.

begin;
\i 00_helpers.sql

select plan(23);

-- Real Lopez owner; tests assume this user exists in household_members.
\set alexis_id '\'2ca99b25-43a8-4135-b5e1-5bb27f752f55\''
-- Synthetic non-member UUID.
\set stranger_id '\'11111111-1111-1111-1111-111111111111\''

-- ── fixtures (as postgres) ──────────────────────────────────────────
select _test.as_postgres();

-- Use a stable fixture-id prefix so we can target rows precisely
-- without colliding with real data.
insert into accounts(id, household_id, name, type)
  values ('aa000000-0000-0000-0000-000000000001', _test.lopez_id(), 'pgtap-account', 'checking');

insert into categories(id, household_id, name, type)
  values ('cc000000-0000-0000-0000-000000000001', _test.lopez_id(), 'pgtap-cat-' || gen_random_uuid()::text, 'expense');

insert into transactions(id, household_id, date, description, amount, type)
  values ('11000000-0000-0000-0000-000000000001', _test.lopez_id(), '2026-05-25', 'pgtap-tx', 1.00, 'Expense');

insert into bills(id, household_id, name)
  values ('bb000000-0000-0000-0000-000000000001', _test.lopez_id(), 'pgtap-bill');

insert into budgets(id, household_id, category, year, month, amount)
  values ('dd000000-0000-0000-0000-000000000001', _test.lopez_id(), 'pgtap-budget-' || gen_random_uuid()::text, 2099, 1, 100.00);

insert into income_plan(id, household_id, source, year, month)
  values ('ee000000-0000-0000-0000-000000000001', _test.lopez_id(), 'pgtap-income', 2099, 1);

insert into bill_match_rules(id, household_id, rule_kind, category)
  values ('ff000000-0000-0000-0000-000000000001', _test.lopez_id(), 'category_map', 'pgtap-rule-cat');

-- ── transactions ─────────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from transactions where id = '11000000-0000-0000-0000-000000000001')::int,
  1,
  'transactions: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from transactions)::int,
  0,
  'transactions: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from transactions$$,
  '42501',
  null,
  'transactions: anon cannot SELECT'
);

-- ── bills ───────────────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from bills where id = 'bb000000-0000-0000-0000-000000000001')::int,
  1,
  'bills: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from bills)::int,
  0,
  'bills: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from bills$$,
  '42501',
  null,
  'bills: anon cannot SELECT'
);

-- ── categories ──────────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from categories where id = 'cc000000-0000-0000-0000-000000000001')::int,
  1,
  'categories: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from categories)::int,
  0,
  'categories: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from categories$$,
  '42501',
  null,
  'categories: anon cannot SELECT'
);

-- ── accounts ────────────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from accounts where id = 'aa000000-0000-0000-0000-000000000001')::int,
  1,
  'accounts: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from accounts)::int,
  0,
  'accounts: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from accounts$$,
  '42501',
  null,
  'accounts: anon cannot SELECT'
);

-- ── budgets ─────────────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from budgets where id = 'dd000000-0000-0000-0000-000000000001')::int,
  1,
  'budgets: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from budgets)::int,
  0,
  'budgets: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from budgets$$,
  '42501',
  null,
  'budgets: anon cannot SELECT'
);

-- ── income_plan ─────────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from income_plan where id = 'ee000000-0000-0000-0000-000000000001')::int,
  1,
  'income_plan: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from income_plan)::int,
  0,
  'income_plan: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from income_plan$$,
  '42501',
  null,
  'income_plan: anon cannot SELECT'
);

-- ── bill_match_rules ────────────────────────────────────────────────
select _test.as_user(:alexis_id);
select is(
  (select count(*) from bill_match_rules where id = 'ff000000-0000-0000-0000-000000000001')::int,
  1,
  'bill_match_rules: member can SELECT a Lopez fixture row'
);

select _test.as_user(:stranger_id);
select is(
  (select count(*) from bill_match_rules)::int,
  0,
  'bill_match_rules: synthetic non-member sees zero rows'
);

select _test.as_anon();
select throws_ok(
  $$select count(*) from bill_match_rules$$,
  '42501',
  null,
  'bill_match_rules: anon cannot SELECT'
);

-- ── cross-cutting INSERT tests ──────────────────────────────────────
-- A. Member CAN insert a row with household_id = Lopez and see it back.
select _test.as_user(:alexis_id);
insert into transactions(household_id, date, description, amount, type)
  values (_test.lopez_id(), '2026-05-25', 'pgtap member insert', 2.00, 'Expense');
select cmp_ok(
  (select count(*) from transactions where description = 'pgtap member insert')::int,
  '=',
  1,
  'transactions: member can INSERT a row with their own household_id'
);

-- B. Synthetic non-member CANNOT insert — RLS WITH CHECK rejects.
select _test.as_user(:stranger_id);
select throws_ok(
  $$insert into transactions(household_id, date, description, amount, type) values ('00000000-0000-0000-0000-000000000001'::uuid, '2026-05-25', 'attacker', 1, 'Expense')$$,
  '42501',
  null,
  'transactions: non-member cannot INSERT (WITH CHECK rejects)'
);

select * from finish();
rollback;
