-- 0018_accounts_owner.sql
--
-- Adds an `owner` column to accounts so each one can be tagged as
-- individually-owned (per household_member display_name) or shared.
-- Free-text mirrors the transactions.member / bills.account convention —
-- no FK so legacy/imported values don't break the schema.
--
-- Values the UI emits:
--   - NULL          → unassigned (default)
--   - 'Shared'      → reserved literal for jointly-owned accounts
--   - <display_name>→ e.g., 'Alexis', 'Marilyn Lopez'

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS owner text NULL;

COMMENT ON COLUMN public.accounts.owner IS
  'Display name of the owning household_member, or the literal ''Shared'', or NULL.';
