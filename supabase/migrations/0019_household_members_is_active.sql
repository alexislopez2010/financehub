-- 0019_household_members_is_active.sql
--
-- Adds an `is_active` flag to household_members so an owner can disable a
-- member's access without deleting the row (and losing historical context).
--
-- Mirrors the Supabase auth.users.banned_until convention: when the admin
-- "disables" a member, the corresponding auth user is also banned via
-- set-household-member-active Edge Function. The flag itself is the
-- application-visible signal; the auth-side ban is what actually blocks
-- login at the gateway.

ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.household_members.is_active IS
  'Application-level enabled flag. Pair with auth.users banned_until to actually block login.';
