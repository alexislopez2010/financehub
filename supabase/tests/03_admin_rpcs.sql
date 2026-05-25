-- supabase/tests/03_admin_rpcs.sql
-- Phase 2M.T2 — contract tests for the four admin RPCs:
--   admin_list_household_users(h_id)
--   admin_update_household_user(h_id, target_user, new_role, new_display_name)
--   admin_reset_user_mfa(h_id, target_user)
--   admin_remove_household_user(h_id, target_user)
--
-- For each RPC: anon/non-member/member → raise; owner with bogus h_id
-- → raise; owner with valid args → success + observable side effect.
--
-- Every test runs inside the outer BEGIN/ROLLBACK so no auth.mfa_factors
-- rows, no household_members rows, and no display_name edits survive.

begin;
\i 00_helpers.sql

select plan(18);

-- ── fixtures ─────────────────────────────────────────────────────────
-- alexis (real owner, will demote himself mid-test to exercise the
-- non-owner branch and re-promote before owner-only assertions).
\set alexis_id '\'2ca99b25-43a8-4135-b5e1-5bb27f752f55\''
-- marilyn (real owner — used as the stable owner identity that stays
-- 'owner' across the whole file).
\set marilyn_id '\'8bfb9233-3ca8-4a35-b3b6-23b1f319b246\''
-- synthetic non-member uuid
\set stranger_id '\'11111111-1111-1111-1111-111111111111\''
-- a bogus household id distinct from the real Lopez id
\set bogus_household '\'99999999-9999-9999-9999-999999999999\''

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ admin_list_household_users                                       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1: anon cannot call — EXECUTE is granted only to `authenticated`,
-- so the call fails with 42501 (permission denied for function)
-- BEFORE the body even runs. This is strictly stronger than the
-- "owners-only" raise inside the body.
select _test.as_anon();
select throws_ok(
  format($$select * from admin_list_household_users(%L::uuid)$$, _test.lopez_id()),
  '42501',
  null,
  'admin_list: anon cannot EXECUTE (permission denied)'
);

-- 2: a synthetic non-member is rejected by the owner check.
select _test.as_user(:stranger_id);
select throws_ok(
  format($$select * from admin_list_household_users(%L::uuid)$$, _test.lopez_id()),
  'P0001',
  'not authorized: owners only',
  'admin_list: non-member raises owners-only'
);

-- 3: a member who is NOT an owner is rejected. Demote Alexis to member
-- (as Marilyn-the-owner), then call as Alexis. Re-promote afterward.
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;

select _test.as_user(:alexis_id);
select throws_ok(
  format($$select * from admin_list_household_users(%L::uuid)$$, _test.lopez_id()),
  'P0001',
  'not authorized: owners only',
  'admin_list: non-owner member raises owners-only'
);

-- restore: promote Alexis back so subsequent owner-side tests work
select _test.as_user(:marilyn_id);
update household_members set role = 'owner' where user_id = :alexis_id;

-- 4: owner with bogus h_id → "unknown household"
select _test.as_user(:alexis_id);
select throws_ok(
  format($$select * from admin_list_household_users(%L::uuid)$$, :bogus_household),
  'P0001',
  'unknown household',
  'admin_list: owner with bogus h_id raises unknown household'
);

-- 5: owner with valid h_id → returns at least the calling owner row
select _test.as_user(:alexis_id);
select cmp_ok(
  (select count(*) from admin_list_household_users(_test.lopez_id()))::int,
  '>=',
  1,
  'admin_list: owner sees at least one row'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ admin_update_household_user                                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 6: non-owner → owners-only (demote-and-restore pattern again)
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;

select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_update_household_user(%L::uuid, %L::uuid, 'member', null)$$,
    _test.lopez_id(), :marilyn_id
  ),
  'P0001',
  'not authorized: owners only',
  'admin_update: non-owner raises owners-only'
);

select _test.as_user(:marilyn_id);
update household_members set role = 'owner' where user_id = :alexis_id;

-- 7: owner with bogus h_id → unknown household
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_update_household_user(%L::uuid, %L::uuid, 'member', null)$$,
    :bogus_household, :marilyn_id
  ),
  'P0001',
  'unknown household',
  'admin_update: owner with bogus h_id raises unknown household'
);

-- 8: owner with invalid role string → "invalid role: …"
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_update_household_user(%L::uuid, %L::uuid, 'super-admin', null)$$,
    _test.lopez_id(), :marilyn_id
  ),
  'P0001',
  'invalid role: super-admin',
  'admin_update: owner with invalid role raises invalid role'
);

-- 9: happy path — owner edits Marilyn's display_name; verify via select.
select _test.as_user(:alexis_id);
select admin_update_household_user(
  _test.lopez_id(), :marilyn_id, null, 'Marilyn (pgtap)'
);
select is(
  (select display_name from household_members where user_id = :marilyn_id),
  'Marilyn (pgtap)',
  'admin_update: owner can change another member display_name'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ admin_reset_user_mfa                                             ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 10: non-owner → owners-only
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;

select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_reset_user_mfa(%L::uuid, %L::uuid)$$,
    _test.lopez_id(), :marilyn_id
  ),
  'P0001',
  'not authorized: owners only',
  'admin_reset_mfa: non-owner raises owners-only'
);

select _test.as_user(:marilyn_id);
update household_members set role = 'owner' where user_id = :alexis_id;

-- 11: owner with bogus h_id → unknown household
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_reset_user_mfa(%L::uuid, %L::uuid)$$,
    :bogus_household, :marilyn_id
  ),
  'P0001',
  'unknown household',
  'admin_reset_mfa: owner with bogus h_id raises unknown household'
);

-- 12: owner with target that is NOT a member → "user is not a member …"
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_reset_user_mfa(%L::uuid, %L::uuid)$$,
    _test.lopez_id(), :stranger_id
  ),
  'P0001',
  'user is not a member of this household',
  'admin_reset_mfa: target-not-a-member raises'
);

-- 13: owner with valid target → RPC succeeds and returns a count equal
-- to the number of VERIFIED factors that existed before the call.
-- The live DB may have any number of factors for Marilyn, so we
-- snapshot the count as `postgres` (only role with read access to
-- `auth.mfa_factors`) into a temp table that the authenticated role
-- can read, then compare against the RPC return value.
-- Everything rolls back at end-of-file, so production mfa_factors rows
-- are untouched.
select _test.as_postgres();
create temp table _t13_before (n int);
grant select on _t13_before to public;
insert into _t13_before
  select count(*)::int from auth.mfa_factors
   where user_id = :marilyn_id and status = 'verified';

select _test.as_user(:alexis_id);
select is(
  (select admin_reset_user_mfa(_test.lopez_id(), :marilyn_id))::int,
  (select n from _t13_before),
  'admin_reset_mfa: returns the prior verified factor count'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ admin_remove_household_user                                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 14: non-owner → owners-only
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;

select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_remove_household_user(%L::uuid, %L::uuid)$$,
    _test.lopez_id(), :marilyn_id
  ),
  'P0001',
  'not authorized: owners only',
  'admin_remove: non-owner raises owners-only'
);

select _test.as_user(:marilyn_id);
update household_members set role = 'owner' where user_id = :alexis_id;

-- 15: owner removing self → "owners cannot remove themselves …"
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_remove_household_user(%L::uuid, %L::uuid)$$,
    _test.lopez_id(), :alexis_id
  ),
  'P0001',
  'owners cannot remove themselves; transfer ownership first',
  'admin_remove: owner removing self raises'
);

-- 16: owner removing another owner → "cannot remove an owner directly …"
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_remove_household_user(%L::uuid, %L::uuid)$$,
    _test.lopez_id(), :marilyn_id
  ),
  'P0001',
  'cannot remove an owner directly; demote to member first',
  'admin_remove: owner removing owner raises'
);

-- 17: owner removing a target that is not a member → "user is not a
-- member of this household". stranger_id is never a member.
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$select admin_remove_household_user(%L::uuid, %L::uuid)$$,
    _test.lopez_id(), :stranger_id
  ),
  'P0001',
  'user is not a member of this household',
  'admin_remove: target-not-a-member raises'
);

-- 18: owner removing a real member succeeds; verify count = 0 after.
-- Demote Alexis to member as Marilyn, then remove Alexis as Marilyn.
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;
select admin_remove_household_user(_test.lopez_id(), :alexis_id);
select is(
  (select count(*) from household_members where user_id = :alexis_id)::int,
  0,
  'admin_remove: owner can remove a member, row disappears'
);

select * from finish();
rollback;
