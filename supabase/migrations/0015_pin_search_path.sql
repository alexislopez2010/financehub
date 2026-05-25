-- supabase/migrations/0015_pin_search_path.sql
-- Phase 2N T3 — pin search_path on the remaining mutable functions.
-- Pattern mirrors 0005_pin_search_path.sql; these are stragglers added after
-- 0005 (advisor lint: function_search_path_mutable). ALTER FUNCTION ... SET
-- preserves the function body and is preferred over drop/recreate.

alter function public.clamp_due_day(nominal_day integer, ref_date date)
  set search_path = public, pg_temp;

alter function public.rpc_advisor_can_afford(p_household_id uuid, p_amount numeric, p_category text, p_floor numeric)
  set search_path = public, pg_temp;

alter function public.rpc_advisor_optimization_candidates(p_household_id uuid)
  set search_path = public, pg_temp;

alter function public.rpc_advisor_project_cash_flow(p_household_id uuid, p_horizon_days integer)
  set search_path = public, pg_temp;

alter function public.rpc_advisor_snapshot(p_household_id uuid)
  set search_path = public, pg_temp;

alter function public.rpc_advisor_spending_anomalies(p_household_id uuid, p_lookback_months integer)
  set search_path = public, pg_temp;

alter function public.set_transaction_account_id()
  set search_path = public, pg_temp;

alter function public.update_updated_at()
  set search_path = public, pg_temp;
