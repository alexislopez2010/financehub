-- 0030_forecast_exclude_flag.sql
-- Lets a bill or category be removed from the Forecast surface without deleting
-- it. Additive + defaulted false, so existing rows keep appearing. Excluded
-- items are skipped by the projection engine and listed in a re-add section.

alter table bills
  add column if not exists exclude_from_forecast boolean not null default false;

alter table categories
  add column if not exists exclude_from_forecast boolean not null default false;
