-- supabase/tests/00_helpers.sql
-- Phase 2M.T1 — reusable helpers for the pgTAP test suite.
--
-- USAGE: every test file MUST wrap its body in
--
--     begin;
--     \i 00_helpers.sql
--     select plan(<N>);
--     ...
--     select * from finish();
--     rollback;
--
-- The outer BEGIN/ROLLBACK is the safety net — even if pgTAP is missing
-- or an assertion explodes, the transaction is discarded. SAFE to run
-- against any environment (including prod), but a non-prod DB is
-- preferred.
--
-- pgTAP must already be installed (see migrations/0012a_pgtap.sql).
-- We resolve pgTAP via the search_path below; functions live in the
-- `extensions` schema on Supabase by convention.

set search_path = public, extensions, pg_catalog;

-- ── Helper schema ────────────────────────────────────────────────────
-- A separate schema keeps test scaffolding from polluting public.
-- Created idempotently so the same file can be \i-d into many tests
-- in the same psql invocation (running 01_, then 02_, etc.).
create schema if not exists _test;

-- USAGE granted to public so anon/authenticated/postgres can all call
-- the role-swap helpers regardless of which role the test is currently
-- impersonating. The helpers are setup-only and never reachable via
-- PostgREST, so this is not a real security surface.
grant usage on schema _test to public;

-- ── _test.as_user(uid) ───────────────────────────────────────────────
-- Impersonates the `authenticated` role with the given user UUID as the
-- JWT `sub` claim. Mirrors how Supabase PostgREST injects request.jwt.*
-- GUCs per-request, which is what auth.uid() actually reads.
--
-- NOT security-definer: SET LOCAL ROLE is forbidden inside DEFINER
-- functions. SECURITY INVOKER + a broad EXECUTE grant lets every role
-- (including anon) hop back to authenticated.
--
-- Uses set_config(..., true) which is equivalent to SET LOCAL — the
-- value resets at COMMIT/ROLLBACK, so the outer transaction wrapper
-- contains all auth state.
create or replace function _test.as_user(uid uuid) returns void
  language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.aal', 'aal2', true);
end $$;

grant execute on function _test.as_user(uuid) to public;

-- ── _test.as_anon() ──────────────────────────────────────────────────
-- Impersonates an unauthenticated request — anon role, no JWT claims.
-- Used to prove RLS rejects access without a session.
create or replace function _test.as_anon() returns void
  language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.aal', '', true);
end $$;

grant execute on function _test.as_anon() to public;

-- ── _test.as_postgres() ──────────────────────────────────────────────
-- Drops back to the superuser-ish migrator role. Used by setup blocks
-- that need to insert fixture rows directly into RLS-protected tables
-- (bypassing the "no direct membership insert" policy, for example).
-- Never used to assert behavior — only to fabricate fixtures.
create or replace function _test.as_postgres() returns void
  language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.aal', '', true);
end $$;

grant execute on function _test.as_postgres() to public;

-- ── _test.lopez_id() ─────────────────────────────────────────────────
-- The hard-coded Lopez household UUID. Wrapped so test files don't
-- repeat the magic string.
create or replace function _test.lopez_id() returns uuid
  language sql immutable as $$
  select '00000000-0000-0000-0000-000000000001'::uuid
$$;

grant execute on function _test.lopez_id() to public;
