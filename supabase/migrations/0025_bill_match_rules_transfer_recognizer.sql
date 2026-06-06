-- supabase/migrations/0025_bill_match_rules_transfer_recognizer.sql
-- Phase 3J — extend bill_match_rules so the import flow can recognize known
-- description patterns (AmEx "MOBILE PAYMENT - THANK YOU", Citibank
-- "AMERICAN EXPR ACH PMT") as Transfer rows at import time AND auto-pair
-- them to their counterparties on the linked account.
--
-- All changes are additive + nullable; existing rules are unaffected.

alter table bill_match_rules
  add column if not exists tx_type_override text,
  add column if not exists pair_account_filter text;

-- Allow the new 'transfer_recognizer' rule_kind alongside the existing two.
alter table bill_match_rules
  drop constraint if exists bill_match_rules_rule_kind_check;
alter table bill_match_rules
  add constraint bill_match_rules_rule_kind_check
  check (rule_kind in ('category_map','name_keyword','transfer_recognizer'));

-- transfer_recognizer requires keyword + tx_type_override; old kinds keep
-- their existing column requirements.
alter table bill_match_rules
  drop constraint if exists bill_match_rules_kind_columns_match;
alter table bill_match_rules
  add constraint bill_match_rules_kind_columns_match
  check (
    ((rule_kind = 'category_map')        and (category          is not null)) or
    ((rule_kind = 'name_keyword')        and (keyword           is not null)) or
    ((rule_kind = 'transfer_recognizer') and (keyword           is not null)
                                          and (tx_type_override is not null))
  );

-- Constrain tx_type_override to the canonical transaction types so a typo
-- can't produce a row with type='Tranfser'.
alter table bill_match_rules
  drop constraint if exists bill_match_rules_tx_type_override_check;
alter table bill_match_rules
  add constraint bill_match_rules_tx_type_override_check
  check (tx_type_override is null or tx_type_override in ('Income','Expense','Transfer','Refund'));
