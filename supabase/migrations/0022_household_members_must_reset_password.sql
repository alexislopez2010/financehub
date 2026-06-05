-- 0022_household_members_must_reset_password.sql
--
-- Adds a per-member "force password change on next login" flag.
--
-- Flow:
--   1. Admin sets a temporary password via the set-household-member-password
--      Edge Function (which also flips this flag to true).
--   2. The (app) layout server component reads this flag for the
--      authenticated user on every page navigation. If true, it redirects
--      to /reset-password.
--   3. The /reset-password page calls public.clear_must_reset_password()
--      after the user picks a new password, clearing the flag.
--
-- Default is false so existing rows are unaffected.

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS must_reset_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.household_members.must_reset_password IS
  'When true, the next authenticated page navigation forces a redirect to /reset-password. Set by admin via set-household-member-password EF; cleared by clear_must_reset_password() RPC after the user picks a new password.';

-- Clears the flag for the current authenticated user. SECURITY DEFINER so we
-- don't have to grant UPDATE on household_members to anon; the WHERE clause
-- limits the effect to the caller's own rows via auth.uid().
CREATE OR REPLACE FUNCTION public.clear_must_reset_password()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.household_members
  SET must_reset_password = false
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.clear_must_reset_password() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_must_reset_password() TO authenticated;

COMMENT ON FUNCTION public.clear_must_reset_password() IS
  'Clears household_members.must_reset_password for auth.uid(). Called by /reset-password after the user picks a new password. Idempotent.';
