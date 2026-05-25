# Supabase pgTAP tests

Schema-level assertions for the financehub Postgres database — RLS
policies, update guards, triggers, RPC contracts, and CHECK constraints.

Every `.sql` file in this directory is self-wrapped in
`BEGIN; ... ROLLBACK;` so a test run NEVER mutates the database, even
on failure. SAFE to run against any environment (including prod), but a
non-prod DB is preferred.

## File layout

| File | Coverage |
|---|---|
| `00_helpers.sql` | `_test.as_user(uuid)`, `_test.as_anon()`, `_test.as_postgres()`, `_test.lopez_id()` — included via `\i 00_helpers.sql` by every test file. |
| `01_household_members.sql` | RLS SELECT/INSERT/UPDATE/DELETE policies on `household_members`, update guard trigger, last-owner protection. |
| `02_transactions_rls.sql` | RLS read + insert coverage for `transactions`, `bills`, `categories`, `accounts`, `budgets`, `income_plan`, `bill_match_rules`. |
| `03_admin_rpcs.sql` | Contract tests for the four admin RPCs (`admin_list_household_users`, `admin_update_household_user`, `admin_reset_user_mfa`, `admin_remove_household_user`) — anon EXECUTE denial, owner-only enforcement, unknown-household raises, self-removal protection, owner-removal protection, MFA reset return value. |
| `04_constraints.sql` | `bill_match_rules` `rule_kind`-to-companion-column CHECK, `bills.due_day` range CHECK, `create_transfer` pairing invariant (two legs, opposite signs, same date, shared `transfer_pair_id`). |
| `05_triggers.sql` | `handle_new_user` (null email, off-allowlist, on-allowlist, case-insensitive lookup), `household_signup_allowlist_normalize` (lowercases email on insert), `household_members_update_guard` last-owner protection cross-owner case. |

Files run in lexical order. Add new tests with the next available numeric
prefix.

## Prerequisites

### pgTAP extension

The first run requires the `pgtap` extension. It is installed by
migration `0012a_pgtap.sql`:

```sql
create extension if not exists pgtap with schema extensions;
```

The migration is idempotent. If you're working against a fresh Supabase
project, apply migrations through `0012a_pgtap.sql` first.

### Connection string

The runner reads `SUPABASE_DB_URL` from the environment:

```bash
export SUPABASE_DB_URL="postgresql://postgres:<password>@<host>:5432/postgres"
```

For local development, put this in a `.env.test` (gitignored) and source
it before running. The connection should use the `postgres` superuser
role — the tests `set role` into `authenticated` / `anon` / back to
`postgres` themselves to exercise RLS.

## Running

From the repo root:

```bash
npm run db:test
```

The runner (`scripts/db-test.mjs`) invokes `psql` once per test file:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/01_household_members.sql
```

You can run any single file directly the same way for tighter iteration.
The runner parses pgTAP's TAP output (`ok N`, `not ok N`, `1..N`) and
exits non-zero on any failure.

### Direct psql invocation (no Node)

```bash
cd supabase/tests
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 01_household_members.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f 02_transactions_rls.sql
```

The `\i 00_helpers.sql` directive is relative to psql's working
directory, which is why the runner `cd`s into `supabase/tests` first.

## Safety guarantees

- Every test file ends with `rollback;`. Even if an assertion explodes
  mid-file, the outer transaction is discarded.
- Helper functions live in their own `_test` schema. They're recreated
  inside the transaction each run, so nothing leaks.
- The runner has no retry / no parallelism — failures surface
  immediately.

## Authoring new tests

1. Pick the next free numeric prefix (`03_...`).
2. Start with the boilerplate:

   ```sql
   begin;
   \i 00_helpers.sql

   select plan(<N>);

   -- assertions here

   select * from finish();
   rollback;
   ```

3. Use `_test.as_user(<uuid>)` to impersonate a member; pick from the
   real seeded household_members for "is a member" fixtures, and
   fabricate UUIDs (`11111111-1111-...`) for the "is NOT a member" path.
4. For tables besides `household_members`, fixtures can be `INSERT`-ed
   under `_test.as_postgres()` because they don't FK-reference
   `auth.users`. The `household_members.user_id → auth.users(id)` FK
   means real existing user UUIDs are required for `household_members`
   fixtures.
5. Use `throws_ok($SQL$, '42501', null, '...')` for "this should be
   rejected by RLS / permission". Use `is(...)` for value equality and
   `cmp_ok(..., '>=', ..., ...)` when row counts depend on live data.

## Out of scope (handled by later tasks)

- pgTAP CI integration (single-developer family app — local runs only,
  for now).
- Authenticated Playwright tests and the `dev_grant_aal2` helper land
  in Phase 2M.T3.
