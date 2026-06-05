-- 0020_accounts_import_format.sql
--
-- Per-account upload format restriction. When set, the import flow
-- rejects any uploaded file whose detected format doesn't match,
-- preventing accidental mis-routing of one bank's CSV into another
-- account's running balance.
--
-- Values are free-text but the UI emits one of:
--   'Chase' | 'Capital One' | 'Citibank' | 'Discover' | 'Amex' |
--   'Generic' | 'QFX/OFX'
-- NULL means "no restriction" (any detected adapter accepted) so this
-- is backward compatible — existing accounts keep working until the
-- user opts in via the EditAccountDialog.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS import_format text NULL;

COMMENT ON COLUMN public.accounts.import_format IS
  'Required upload format. NULL accepts any detected adapter; otherwise must match the detected adapter name verbatim.';
