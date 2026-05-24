-- supabase/migrations/0005_pin_search_path.sql
-- Pins search_path on the existing SECURITY DEFINER helper so the
-- function always resolves `household_members` from `public`,
-- never from a user-controlled schema.

create or replace function is_household_member(h_id uuid) returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = h_id
  );
$$;
