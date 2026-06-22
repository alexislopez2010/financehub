-- 0029_forecast_tiers_and_profiles.sql
-- Phase 3N (forecasting) — three-tier spend taxonomy + per-bill seasonal profile.
-- Additive + nullable; no breakage. tier resolution order is application-side
-- (bills.tier > categories.tier > auto-derived), so columns are advisory hints.

alter table categories
  add column if not exists tier text;
alter table categories
  drop constraint if exists categories_tier_check;
alter table categories
  add constraint categories_tier_check
  check (tier is null or tier in ('essential','services','discretionary'));

alter table bills
  add column if not exists tier text,
  add column if not exists seasonal_profile jsonb;
alter table bills
  drop constraint if exists bills_tier_check;
alter table bills
  add constraint bills_tier_check
  check (tier is null or tier in ('essential','services','discretionary'));
