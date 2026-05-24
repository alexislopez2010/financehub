-- supabase/migrations/0009_bill_match_rules.sql
-- Phase 1.4 — externalise the bill-to-transaction match rules out of
-- Dashboard.jsx (BILL_TX_MAP, BILL_NAME_KW). Phase 2 reads from this
-- table; the legacy app keeps its hardcoded copy until cutover.

create table if not exists bill_match_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade not null,
  bill_id uuid references bills(id) on delete cascade,
  -- Either bill_id matches a single bill, OR bill_name + category match
  -- the legacy BILL_TX_MAP pattern (bill referenced by name string).
  bill_name text,             -- nullable, used when bill_id is null
  category text,              -- target transaction category
  sub_category text,          -- nullable, narrows within category
  keyword text,               -- description keyword, lowercased; nullable
  account_filter text,        -- nullable, narrows by account name
  rule_kind text not null check (rule_kind in ('category_map','name_keyword')),
  created_at timestamptz default now()
);

create index if not exists bill_match_rules_household_idx
  on bill_match_rules(household_id);
create index if not exists bill_match_rules_bill_idx
  on bill_match_rules(household_id, bill_id)
  where bill_id is not null;

alter table bill_match_rules enable row level security;

drop policy if exists "household read rules" on bill_match_rules;
drop policy if exists "household write rules" on bill_match_rules;
create policy "household read rules" on bill_match_rules
  for select using (is_household_member(household_id));
create policy "household write rules" on bill_match_rules
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- Seed from the hardcoded BILL_TX_MAP (Dashboard.jsx:2124-2149)
insert into bill_match_rules (household_id, bill_name, category, sub_category, keyword, rule_kind) values
  ('00000000-0000-0000-0000-000000000001','AI Services',        'Entertainment & Subscriptions','AI Services',            null,           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Books/Courses',      'Entertainment & Subscriptions','Books & Courses',        null,           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Books/Media',        'Entertainment & Subscriptions','Books & Media',          null,           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Car Payment',        'Transportation',               'Auto Loan/Lease',        null,           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Debt Payment',       'Financial',                    'Debt Payment',           null,           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Dog Food/Supplies',  'Personal & Family',            'Pets',                   null,           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Electric',           'Housing','Utilities (Electric/Gas/Water)','firstenergy', 'category_map'),
  ('00000000-0000-0000-0000-000000000001','Electric',           'Housing','Utilities (Electric/Gas/Water)','electric',    'category_map'),
  ('00000000-0000-0000-0000-000000000001','Gas',                'Housing','Utilities (Electric/Gas/Water)','njng',        'category_map'),
  ('00000000-0000-0000-0000-000000000001','Gas',                'Housing','Utilities (Electric/Gas/Water)','natgas',      'category_map'),
  ('00000000-0000-0000-0000-000000000001','Gas',                'Housing','Utilities (Electric/Gas/Water)','natural gas', 'category_map'),
  ('00000000-0000-0000-0000-000000000001','Water/Sewer',        'Housing','Utilities (Electric/Gas/Water)','american water','category_map'),
  ('00000000-0000-0000-0000-000000000001','Water/Sewer',        'Housing','Utilities (Electric/Gas/Water)','water',       'category_map'),
  ('00000000-0000-0000-0000-000000000001','Gifts',              'Family & Gifts',null,null,                                              'category_map'),
  ('00000000-0000-0000-0000-000000000001','Gym/Fitness',        'Health & Medical','Fitness',null,                                       'category_map'),
  ('00000000-0000-0000-0000-000000000001','Home Insurance',     'Housing','Home Insurance',null,                                         'category_map'),
  ('00000000-0000-0000-0000-000000000001','Mortgage/Rent',      'Housing',null,'mortgage',                                               'category_map'),
  ('00000000-0000-0000-0000-000000000001','Mortgage/Rent',      'Housing',null,'freedom mtg',                                            'category_map'),
  ('00000000-0000-0000-0000-000000000001','Movies/Events',      'Entertainment & Subscriptions',null,'cinemark',                          'category_map'),
  ('00000000-0000-0000-0000-000000000001','Movies/Events',      'Entertainment & Subscriptions',null,'movie',                             'category_map'),
  ('00000000-0000-0000-0000-000000000001','Movies/Events',      'Entertainment & Subscriptions',null,'amc',                               'category_map'),
  ('00000000-0000-0000-0000-000000000001','Parking/Tolls',      'Transportation',null,'ezpass',                                          'category_map'),
  ('00000000-0000-0000-0000-000000000001','Parking/Tolls',      'Transportation',null,'e-zpass',                                         'category_map'),
  ('00000000-0000-0000-0000-000000000001','Parking/Tolls',      'Transportation',null,'toll',                                            'category_map'),
  ('00000000-0000-0000-0000-000000000001','Parking/Tolls',      'Transportation',null,'parking',                                         'category_map'),
  ('00000000-0000-0000-0000-000000000001','Phone',              'Housing','Phone',null,                                                  'category_map'),
  ('00000000-0000-0000-0000-000000000001','School Fees',        'Kids','School Fees',null,                                               'category_map'),
  ('00000000-0000-0000-0000-000000000001','School Tuition',     'Kids',null,'tuition',                                                   'category_map'),
  ('00000000-0000-0000-0000-000000000001','School Tuition',     'Kids',null,'middle road',                                               'category_map'),
  ('00000000-0000-0000-0000-000000000001','Spa/Massage',        'Health & Medical','Spa',null,                                           'category_map'),
  ('00000000-0000-0000-0000-000000000001','Streaming Services', 'Entertainment & Subscriptions','Streaming',null,                         'category_map'),
  ('00000000-0000-0000-0000-000000000001','Subscriptions',      'Entertainment & Subscriptions','Subscriptions',null,                     'category_map'),
  ('00000000-0000-0000-0000-000000000001','Taxes (Federal)',    'Taxes','Federal',null,                                                  'category_map'),
  ('00000000-0000-0000-0000-000000000001','Technology/Software','Software & Apps','Subscriptions',null,                                   'category_map'),
  ('00000000-0000-0000-0000-000000000001','Tithes/Offering',    'Giving','Tithing',null,                                                 'category_map');

-- Seed from BILL_NAME_KW (Dashboard.jsx:2152-2175). One row per keyword.
insert into bill_match_rules (household_id, bill_name, keyword, rule_kind) values
  ('00000000-0000-0000-0000-000000000001','OpenAI (ChatGPT + API)','openai','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Claude AI / Anthropic','anthropic','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Claude AI / Anthropic','claude','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','ElevenLabs','elevenlabs','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Perplexity AI','perplexity','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Undetectable AI','undetectable','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Hedra AI','hedra','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Best Buy Card','best buy','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Best Buy Card','bestbuy','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Best Buy Card','comenity','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Merrick Bank Card','merrick','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Premier / First Premier Cards','premier','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Premier / First Premier Cards','first premier','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Continental Finance','continental','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Apple Services Bundle (PayPal)','apple','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Apple Services Bundle (PayPal)','paypal inst xfer apple','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Pinter','pinter','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Tucker Carlson Network','tucker','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Tucker Carlson Network','tcn','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Cozyla','cozyla','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','NRA Membership','nra','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','LinkedIn Premium','linkedin','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Uber One','uber','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Wired Magazine','wired','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Microsoft 365','microsoft','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','n8n Cloud','n8n','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Canva Pro','canva','name_keyword'),
  ('00000000-0000-0000-0000-000000000001','Regrid','regrid','name_keyword');

-- Backfill bill_id where we can resolve bill_name → bills.id within the same household
update bill_match_rules r
   set bill_id = b.id
  from bills b
 where r.bill_id is null
   and r.household_id = b.household_id
   and r.bill_name = b.name;

-- Cross-column invariant: each rule_kind requires its semantically-relevant
-- columns to be populated. Without this, a category_map row could be inserted
-- with no category, or a name_keyword row with no keyword, both meaningless.
alter table bill_match_rules drop constraint if exists bill_match_rules_kind_columns_match;
alter table bill_match_rules
  add constraint bill_match_rules_kind_columns_match check (
    (rule_kind = 'category_map' and category is not null)
    or
    (rule_kind = 'name_keyword' and keyword is not null)
  );
