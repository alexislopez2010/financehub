-- supabase/migrations/0012_dev_grant_aal2.sql
-- Phase 2M.T3 — Non-prod helper to attach a synthetic verified TOTP factor
-- to a test user so Playwright E2E can satisfy AAL2 without TOTP setup.
--
-- This RPC is callable by:
--   (a) any session where the GUC `app.environment = 'test'` is set, OR
--   (b) the service_role (Playwright globalSetup uses the service role key).
--
-- In production, no caller ever sets `app.environment = 'test'`, and the
-- service role key is server-only and never reaches the browser. The function
-- itself is harmless (it only inserts an mfa_factors row); the safety bar is
-- "won't be called accidentally in prod".
--
-- Permission model:
--   - revoked from public
--   - granted only to service_role
--   - SECURITY DEFINER + pinned search_path (consistent with 0005_pin_search_path.sql)

create or replace function public.dev_grant_aal2(target_user uuid) returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
begin
  if current_setting('app.environment', true) is distinct from 'test'
     and auth.role() is distinct from 'service_role' then
    raise exception 'dev_grant_aal2 is only available in test environments';
  end if;

  -- Synthetic verified TOTP factor. Idempotent: if a factor with the same
  -- friendly_name already exists for this user, do nothing.
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret, created_at, updated_at)
  values (
    gen_random_uuid(),
    target_user,
    'e2e-test-factor',
    'totp',
    'verified',
    'JBSWY3DPEHPK3PXP',
    now(),
    now()
  )
  on conflict do nothing;
end $$;

revoke all on function public.dev_grant_aal2(uuid) from public;
revoke all on function public.dev_grant_aal2(uuid) from anon;
revoke all on function public.dev_grant_aal2(uuid) from authenticated;
grant execute on function public.dev_grant_aal2(uuid) to service_role;

comment on function public.dev_grant_aal2(uuid) is
  'Test-only helper: attaches a synthetic verified TOTP factor so Playwright '
  'can satisfy AAL2. Raises in environments where app.environment is not "test" '
  'unless invoked by the service_role connection.';
