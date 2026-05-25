-- supabase/tests/04_constraints.sql
-- Phase 2M.T2 — CHECK constraint + transfer-pair invariant coverage.
--
-- All fixtures are inserted as the `postgres` role so we don't have to
-- chase RLS WITH CHECK clauses — the goal is to exercise the column-
-- level constraints, not the policy layer (RLS is covered in 02_).
--
-- The whole file rolls back at the bottom so no fixture rows survive.

begin;
\i 00_helpers.sql

select plan(11);

-- Real Lopez owner — used to call create_transfer (which checks
-- is_household_member(auth.uid())).
\set alexis_id '\'2ca99b25-43a8-4135-b5e1-5bb27f752f55\''

-- ── fixtures (as postgres) ──────────────────────────────────────────
select _test.as_postgres();

-- Two distinct accounts for the create_transfer happy path.
insert into accounts(id, household_id, name, type)
  values ('aa000000-0000-0000-0000-000000000010', _test.lopez_id(), 'pgtap-from', 'checking');
insert into accounts(id, household_id, name, type)
  values ('aa000000-0000-0000-0000-000000000011', _test.lopez_id(), 'pgtap-to', 'savings');

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ bill_match_rules CHECK (rule_kind requires its companion column) ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1: category_map without category → check_violation
select throws_ok(
  $$insert into bill_match_rules (household_id, rule_kind, category)
    values ('00000000-0000-0000-0000-000000000001', 'category_map', null)$$,
  '23514',
  null,
  'bill_match_rules: rule_kind=category_map requires category'
);

-- 2: name_keyword without keyword → check_violation
select throws_ok(
  $$insert into bill_match_rules (household_id, rule_kind, keyword)
    values ('00000000-0000-0000-0000-000000000001', 'name_keyword', null)$$,
  '23514',
  null,
  'bill_match_rules: rule_kind=name_keyword requires keyword'
);

-- 3: category_map WITH a category → succeeds
insert into bill_match_rules (id, household_id, rule_kind, category)
  values ('cc000000-0000-0000-0000-0000000000c1',
          '00000000-0000-0000-0000-000000000001',
          'category_map', 'pgtap-cat');
select is(
  (select count(*)::int from bill_match_rules
    where id = 'cc000000-0000-0000-0000-0000000000c1'),
  1,
  'bill_match_rules: rule_kind=category_map + category accepted'
);

-- 4: name_keyword WITH a keyword → succeeds
insert into bill_match_rules (id, household_id, rule_kind, keyword)
  values ('cc000000-0000-0000-0000-0000000000c2',
          '00000000-0000-0000-0000-000000000001',
          'name_keyword', 'pgtap-kw');
select is(
  (select count(*)::int from bill_match_rules
    where id = 'cc000000-0000-0000-0000-0000000000c2'),
  1,
  'bill_match_rules: rule_kind=name_keyword + keyword accepted'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ bills.due_day CHECK (1 ≤ due_day ≤ 31)                           ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 5: due_day = 0 → check_violation
select throws_ok(
  $$insert into bills (household_id, name, due_day)
    values ('00000000-0000-0000-0000-000000000001', 'pgtap-bill-zero', 0)$$,
  '23514',
  null,
  'bills.due_day: 0 rejected'
);

-- 6: due_day = 32 → check_violation
select throws_ok(
  $$insert into bills (household_id, name, due_day)
    values ('00000000-0000-0000-0000-000000000001', 'pgtap-bill-32', 32)$$,
  '23514',
  null,
  'bills.due_day: 32 rejected'
);

-- 7: due_day = 1 → accepted
insert into bills (id, household_id, name, due_day)
  values ('bb000000-0000-0000-0000-0000000000b1',
          '00000000-0000-0000-0000-000000000001', 'pgtap-bill-1', 1);
select is(
  (select due_day from bills where id = 'bb000000-0000-0000-0000-0000000000b1'),
  1,
  'bills.due_day: 1 accepted'
);

-- 8: due_day = 31 → accepted
insert into bills (id, household_id, name, due_day)
  values ('bb000000-0000-0000-0000-0000000000b2',
          '00000000-0000-0000-0000-000000000001', 'pgtap-bill-31', 31);
select is(
  (select due_day from bills where id = 'bb000000-0000-0000-0000-0000000000b2'),
  31,
  'bills.due_day: 31 accepted'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ create_transfer pairing invariant                                ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- The RPC is SECURITY DEFINER but explicitly checks
-- is_household_member(p_household_id), which reads auth.uid().
-- Impersonate Alexis so the membership check passes.
--
-- After the call, the two legs share the same transfer_pair_id and
-- their amounts sum to zero (opposite signs). We also assert both legs
-- share the same date.

select _test.as_user(:alexis_id);

select create_transfer(
  _test.lopez_id(),
  'aa000000-0000-0000-0000-000000000010'::uuid,
  'aa000000-0000-0000-0000-000000000011'::uuid,
  250.00,
  '2026-05-25'::date,
  'pgtap-transfer',
  null
) as pair_id \gset

-- 9: exactly two rows share the returned pair_id
select is(
  (select count(*)::int from transactions where transfer_pair_id = :'pair_id'::uuid),
  2,
  'create_transfer: two rows share the transfer_pair_id'
);

-- 10: the two legs have opposite signs (their sum is exactly 0)
select is(
  (select coalesce(sum(amount), -1) from transactions where transfer_pair_id = :'pair_id'::uuid)::numeric,
  0::numeric,
  'create_transfer: legs sum to zero (opposite signs)'
);

-- 11: both legs share the same date (no date-skew bug)
select is(
  (select count(distinct date)::int from transactions where transfer_pair_id = :'pair_id'::uuid),
  1,
  'create_transfer: both legs share the same date'
);

select * from finish();
rollback;
