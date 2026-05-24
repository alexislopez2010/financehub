-- supabase/migrations/0005a_tighten_function_grants.sql
-- Phase 0 follow-up. `REVOKE ALL ... FROM public` alone does not always
-- remove Supabase's separate `anon` grant on SECURITY DEFINER functions.
-- This migration explicitly revokes EXECUTE from `anon` on every Phase 0
-- function flagged by the Supabase security advisor's
-- `anon_security_definer_function_executable` lint.
--
-- Functional impact: none. Our owner-guarded RPCs already return
-- "not authorized" when invoked by an unauthenticated caller. This is
-- defense in depth and clears the advisor warnings.
--
-- We do NOT revoke from `authenticated`:
--   * is_household_member / is_household_owner are called from RLS
--     policy expressions on tables that authenticated users query.
--   * The 5 admin RPCs are intentionally exposed to authenticated
--     callers (and then guarded by is_household_owner inside the body).

revoke execute on function claim_lopez_household() from anon;
revoke execute on function admin_list_household_users(uuid) from anon;
revoke execute on function admin_update_household_user(uuid, uuid, text, text) from anon;
revoke execute on function admin_reset_user_mfa(uuid, uuid) from anon;
revoke execute on function admin_remove_household_user(uuid, uuid) from anon;

-- For helpers and the trigger function we must revoke from PUBLIC as well.
-- `create function` defaults grant EXECUTE to PUBLIC; `revoke from anon`
-- alone doesn't remove that, and the advisor sees anon inheriting via
-- PUBLIC. authenticated keeps its explicit grant (it's required for the
-- RLS policies on transactions/bills/etc. that call these helpers).
revoke execute on function is_household_member(uuid) from public, anon;
revoke execute on function is_household_owner(uuid) from public, anon;

-- Trigger function on auth.users; never meant to be called via PostgREST.
-- Fires from Supabase's privileged auth backend regardless of public grants.
revoke execute on function handle_new_user() from public, anon, authenticated;
