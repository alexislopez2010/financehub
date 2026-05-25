-- supabase/tests/05_triggers.sql
-- Phase 2M.T2 — trigger coverage:
--   * handle_new_user (on auth.users): null-email skip, off-allowlist
--     skip, on-allowlist join with role='member' (Alexis seed is the
--     pre-existing 'owner', so any second allowlisted user defaults to
--     'member' by the migration 0003 rule).
--   * household_signup_allowlist_normalize: lowercases email on insert.
--     (This is the codebase's "normalize_email" trigger — there is no
--     separate trigger on auth.users; the canonical normalization lives
--     on the allowlist row that handle_new_user reads.)
--   * household_members_update_guard: one more last-owner protection
--     case — last-owner DELETE attempt is filtered out by RLS (covered
--     in 01_) so this file adds the trigger-level last-owner case via
--     an UPDATE that would leave zero owners on a separate household.
--
-- All inserts into auth.users are minimal — only the NOT NULL columns
-- (`id`, `is_sso_user`, `is_anonymous`) plus `email` where relevant.
-- Everything rolls back at end-of-file, so no synthetic auth.users
-- rows escape the transaction. The household_signup_allowlist seed
-- email used here (`pgtap-allowed@example.com`) is removed by the
-- rollback as well.

begin;
\i 00_helpers.sql

select plan(8);

-- ── fixtures used across cases ──────────────────────────────────────
-- Stable synthetic UUIDs for the auth.users inserts below.
\set null_email_uid '\'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01\''
\set off_list_uid   '\'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02\''
\set on_list_uid    '\'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03\''
\set mixed_case_uid '\'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04\''

-- All auth.users + allowlist inserts run as postgres.
select _test.as_postgres();

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ handle_new_user: null email is skipped cleanly                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

insert into auth.users (id, email, is_sso_user, is_anonymous)
  values (:null_email_uid::uuid, null, false, false);

-- 1: no household_members row for the null-email user
select is(
  (select count(*)::int from household_members where user_id = :null_email_uid::uuid),
  0,
  'handle_new_user: null email does not create household_members row'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ handle_new_user: off-allowlist email is skipped                  ║
-- ╚══════════════════════════════════════════════════════════════════╝

insert into auth.users (id, email, is_sso_user, is_anonymous)
  values (:off_list_uid::uuid, 'not-on-the-list@example.com', false, false);

-- 2: no household_members row for an off-allowlist email
select is(
  (select count(*)::int from household_members where user_id = :off_list_uid::uuid),
  0,
  'handle_new_user: off-allowlist email does not create household_members row'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ handle_new_user: on-allowlist email is joined as member          ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Add a fresh allowlist entry that does NOT already correspond to an
-- existing auth.users row. The normalize trigger on the allowlist will
-- lowercase the email. Then insert a new auth.users row matching that
-- entry; handle_new_user should create a household_members row.

insert into household_signup_allowlist (email, household_id)
  values ('pgtap-allowed@example.com', _test.lopez_id());

insert into auth.users (id, email, is_sso_user, is_anonymous)
  values (:on_list_uid::uuid, 'pgtap-allowed@example.com', false, false);

-- 3: a household_members row was created for the allowlisted user
select is(
  (select count(*)::int from household_members where user_id = :on_list_uid::uuid),
  1,
  'handle_new_user: allowlisted email creates household_members row'
);

-- 4: the new row defaults to role='member' (Lopez already has owners)
select is(
  (select role from household_members where user_id = :on_list_uid::uuid),
  'member',
  'handle_new_user: allowlisted user joins as member (not owner)'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ household_signup_allowlist_normalize: lowercases email           ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- Insert a mixed-case email into the allowlist; the trigger normalizes
-- BEFORE the row lands, so the stored value should be lowercase.
-- Use a household_id that already exists (Lopez); we then immediately
-- delete the row (still inside the transaction) so the next test isn't
-- polluted. (The transaction rollback would catch it too, but we're
-- being defensive.)

insert into household_signup_allowlist (email, household_id)
  values ('Foo@EXAMPLE.com', _test.lopez_id());

-- 5: stored email is lowercase
select is(
  (select email from household_signup_allowlist where email = 'foo@example.com'),
  'foo@example.com',
  'household_signup_allowlist_normalize: lowercases email on insert'
);

-- 6: the original mixed-case form is NOT present
select is(
  (select count(*)::int from household_signup_allowlist where email = 'Foo@EXAMPLE.com'),
  0,
  'household_signup_allowlist_normalize: mixed-case form not stored'
);

delete from household_signup_allowlist where email = 'foo@example.com';

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ handle_new_user respects normalized allowlist lookup             ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- The allowlist is normalized on insert. handle_new_user looks up by
-- lower(new.email), so a mixed-case auth.users email still matches a
-- lowercase allowlist row. Reuse the 'pgtap-allowed@example.com' entry
-- already created above (still in this transaction).

insert into auth.users (id, email, is_sso_user, is_anonymous)
  values (:mixed_case_uid::uuid, 'PGTAP-allowed@Example.COM', false, false);

-- 7: row was created despite the case mismatch in auth.users.email
select is(
  (select count(*)::int from household_members where user_id = :mixed_case_uid::uuid),
  1,
  'handle_new_user: lookup is case-insensitive (lower() on email)'
);

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ household_members_update_guard: last-owner protection extra case ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- 01_ already covers self-demotion of the last owner. Here we exercise
-- the same guard from the cross-owner angle: Alexis (owner) demotes
-- Marilyn (the other owner), then tries to demote himself. With Marilyn
-- demoted, Alexis becomes the last owner and the trigger must raise.

\set alexis_id '\'2ca99b25-43a8-4135-b5e1-5bb27f752f55\''
\set marilyn_id '\'8bfb9233-3ca8-4a35-b3b6-23b1f319b246\''

select _test.as_user(:alexis_id);
update household_members set role = 'member' where user_id = :marilyn_id;

select _test.as_user(:alexis_id);
select throws_ok(
  format(
    $$update household_members set role = 'member' where user_id = %L::uuid$$,
    :alexis_id
  ),
  'P0001',
  'cannot demote the last owner of a household',
  'household_members_update_guard: last-owner protection fires on cross-owner sequence'
);

select * from finish();
rollback;
