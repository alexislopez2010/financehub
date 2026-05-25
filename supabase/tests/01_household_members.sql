-- supabase/tests/01_household_members.sql
-- Phase 2M.T1 — RLS + update guard + last-owner trigger coverage for
-- the `household_members` table.
--
-- All assertions roll back at end-of-file. SAFE to run against any
-- environment, but a non-prod DB is preferred.
--
-- The Lopez household currently has TWO real owners (Alexis + Marilyn).
-- Tests use those real UUIDs for "is a member" fixtures and synthetic
-- UUIDs (1111…, 2222…) for "is NOT a member" assertions. The synthetic
-- UUIDs intentionally do not exist in auth.users — RLS policies only
-- read the JWT `sub` claim, so a fabricated UUID works for read-side
-- assertions without violating the household_members.user_id FK.

begin;
\i 00_helpers.sql

select plan(12);

-- ── fixtures ─────────────────────────────────────────────────────────
-- Real users from the seed/allowlist flow. Test relies on them being
-- present in household_members; if either is removed in the future
-- this file needs updating.
-- alexis (owner)
\set alexis_id '\'2ca99b25-43a8-4135-b5e1-5bb27f752f55\''
-- marilyn (owner)
\set marilyn_id '\'8bfb9233-3ca8-4a35-b3b6-23b1f319b246\''
-- synthetic non-member uuids
\set stranger_id '\'11111111-1111-1111-1111-111111111111\''
\set stranger2_id '\'22222222-2222-2222-2222-222222222222\''

-- ── 1: anon cannot read household_members ────────────────────────────
-- The view-own-memberships policy expression calls is_household_member,
-- and migration 0005a revoked EXECUTE on that helper from anon. The
-- table-level grant exists, but the policy probe raises 42501. This
-- is strictly stronger than "no rows visible".
select _test.as_anon();
select throws_ok(
  $$select count(*) from household_members$$,
  '42501',
  null,
  'anon cannot read household_members'
);

-- ── 2: synthetic non-member sees zero rows ──────────────────────────
select _test.as_user(:stranger_id);
select is(
  (select count(*) from household_members)::int,
  0,
  'synthetic non-member sees zero household_members rows'
);

-- ── 3: a real member can read their own row ─────────────────────────
select _test.as_user(:alexis_id);
select cmp_ok(
  (select count(*) from household_members where user_id = :alexis_id)::int,
  '>=',
  1,
  'member can read their own household_members row'
);

-- ── 4: direct INSERT is blocked by the no-direct-insert policy ──────
select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$insert into household_members(user_id, household_id, role) values (%L::uuid, %L::uuid, 'member')$$,
    :stranger_id, _test.lopez_id()
  ),
  '42501',
  null,
  'direct INSERT into household_members is blocked by policy'
);

-- ── 5: a member can update their OWN display_name ───────────────────
select _test.as_user(:alexis_id);
update household_members
   set display_name = 'Alexis (pgtap edit)'
 where user_id = :alexis_id;
select is(
  (select display_name from household_members where user_id = :alexis_id),
  'Alexis (pgtap edit)',
  'member can update their own display_name'
);

-- ── 6: a member CANNOT update their own role directly ───────────────
-- The household_members_update_guard trigger raises when a non-owner
-- tries to change a role. Both Alexis and Marilyn are currently owners
-- on the live DB, so to exercise this branch we first demote Alexis
-- (as Marilyn-the-owner) and then attempt a self-promotion as Alexis.
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;

select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$update household_members set role = 'owner' where user_id = %L::uuid$$,
    :alexis_id
  ),
  'P0001',
  'only an owner can change member role',
  'member cannot promote themselves to owner via direct update'
);

-- restore for the next tests
select _test.as_user(:marilyn_id);
update household_members set role = 'owner' where user_id = :alexis_id;

-- ── 7: an owner CAN update another member's display_name ────────────
select _test.as_user(:marilyn_id);
update household_members
   set display_name = 'Alexis (owner-edited)'
 where user_id = :alexis_id;
select is(
  (select display_name from household_members where user_id = :alexis_id),
  'Alexis (owner-edited)',
  'owner can update another member display_name'
);

-- ── 8: an owner CAN update another member's role ─────────────────────
-- Demote Alexis from owner to member as Marilyn.
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;
select is(
  (select role from household_members where user_id = :alexis_id),
  'member',
  'owner can update another member role'
);

-- ── 9: last owner cannot demote self ────────────────────────────────
-- Alexis is now 'member', leaving Marilyn as the only owner.
-- Demoting Marilyn should fail in the household_members_update_guard
-- trigger ("cannot demote the last owner of a household").
select _test.as_user(:marilyn_id);
select throws_ok(
  format(
    $$update household_members set role = 'member' where user_id = %L::uuid$$,
    :marilyn_id
  ),
  'P0001',
  'cannot demote the last owner of a household',
  'last-owner protection trigger fires on self-demote'
);

-- Re-promote Alexis so the household has two owners again (needed for
-- the next two tests which assume there are >= 2 members).
select _test.as_user(:marilyn_id);
update household_members set role = 'owner' where user_id = :alexis_id;

-- ── 10: an owner can DELETE a non-owner member row ──────────────────
-- We need a third member to delete. Insert one directly as postgres
-- (bypassing the no-direct-insert policy) using Alexis as a stand-in
-- target by first demoting them, then deleting.
select _test.as_user(:marilyn_id);
update household_members set role = 'member' where user_id = :alexis_id;
delete from household_members where user_id = :alexis_id and household_id = _test.lopez_id();
select is(
  (select count(*) from household_members where user_id = :alexis_id)::int,
  0,
  'owner can delete a non-owner member row'
);

-- ── 11: an owner cannot DELETE their own row ────────────────────────
-- The "owner deletes member" policy uses
--   (is_household_owner(household_id) AND user_id <> auth.uid())
-- so an owner's self-delete is filtered out by USING and the DELETE
-- is a no-op (no row matches). We assert exactly that: the row is
-- still there after the attempted self-delete.
select _test.as_user(:marilyn_id);
delete from household_members where user_id = :marilyn_id and household_id = _test.lopez_id();
select is(
  (select count(*) from household_members where user_id = :marilyn_id)::int,
  1,
  'owner cannot delete their own household_members row (policy filters self)'
);

-- ── 12: a non-owner cannot DELETE anything ──────────────────────────
-- Re-insert Alexis (as postgres) as a member, then have them try to
-- delete Marilyn — should be a no-op (policy USING filters them out).
select _test.as_postgres();
insert into household_members(user_id, household_id, display_name, role)
  values (:alexis_id, _test.lopez_id(), 'Alexis', 'member')
  on conflict (user_id, household_id) do nothing;

select _test.as_user(:alexis_id);
delete from household_members where user_id = :marilyn_id;
select is(
  (select count(*) from household_members where user_id = :marilyn_id)::int,
  1,
  'non-owner cannot delete another member row (policy filters)'
);

select * from finish();
rollback;
