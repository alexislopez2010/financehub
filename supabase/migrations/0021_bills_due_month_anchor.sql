-- 0021_bills_due_month_anchor.sql
--
-- Adds a due-month anchor to bills so quarterly + annual cadences know
-- WHICH month(s) they land in. Required because the existing schema only
-- stored a due_day (1-31) and a frequency string, leaving no way to say
-- "this quarterly bill hits in March, June, September, December" vs
-- "January, April, July, October".
--
-- Cadence semantics:
--   - 'Monthly'   → ignores due_month_anchor; lands every month
--   - 'Biweekly'  → ignores due_month_anchor; ~twice per month
--   - 'Quarterly' → due in due_month_anchor + every 3 months thereafter
--                   (so anchor=3 means Mar/Jun/Sep/Dec)
--   - 'Annual'    → due only in due_month_anchor
--
-- NULL is allowed for backward compatibility — bills that have it null
-- and use Quarterly/Annual will not surface in Plan/Forecast until the
-- user sets the anchor. The UI surfaces a warning so the user notices.

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS due_month_anchor int NULL
  CHECK (due_month_anchor IS NULL OR (due_month_anchor BETWEEN 1 AND 12));

COMMENT ON COLUMN public.bills.due_month_anchor IS
  'For Quarterly bills: anchor month (1..12); occurrences repeat every 3 months from this anchor. For Annual bills: the single month it hits. Ignored for Monthly/Biweekly.';
