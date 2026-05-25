# Phase 2M — pgTAP + authenticated E2E

> Subagent-driven; ~3 dispatches.

**Goal:** Add the safety nets that should exist before cutover. **(a)** pgTAP schema-level tests proving RLS policies + SECURITY DEFINER RPCs actually enforce what we think they do. **(b)** Convert the three skipped Playwright tests in `auth-flow.spec.ts` into real authenticated journeys using a service-role-provisioned test user.

**Architecture:** pgTAP tests live in `supabase/tests/*.sql` and run via a new `npm run db:test` script that invokes `psql` against the live DB inside an outer transaction (`BEGIN; … ROLLBACK;`) so no state is mutated. Each test impersonates either a non-member, a member, or an owner using `set local request.jwt.claim.sub = '<uuid>'`. A small README documents the local-vs-CI story (local: against the dev DB; CI: deferred — a future setup can run the same `.sql` against a local supabase-cli stack).

For the E2E side, Playwright's `globalSetup` provisions a test user via `supabase.auth.admin.createUser()` with the service role key (read from `SUPABASE_SERVICE_ROLE_KEY` env, never committed). The user is created with `email_confirm: true` and added to the Lopez household as a `member`. A test-only RPC `dev_grant_aal2(target_user uuid)` (gated to non-prod) attaches a synthetic verified TOTP factor so the user can pass `mustChallenge`. Tests run authenticated; `globalTeardown` deletes the user + factor. **No production rows touched.**

## File structure

```
supabase/
├── tests/                                NEW
│   ├── 00_helpers.sql                    pgTAP plan harness + JWT claim helpers
│   ├── 01_household_members.sql          RLS + last-owner trigger tests
│   ├── 02_transactions_rls.sql           transactions/bills/categories RLS
│   ├── 03_admin_rpcs.sql                 admin_list/update/reset_mfa/remove tests
│   ├── 04_constraints.sql                bill_match_rules CHECK + bills.due_day CHECK + transfer pair integrity
│   ├── 05_triggers.sql                   handle_new_user, normalize_email, household_members_update_guard
│   └── README.md                         How to run (psql + env vars + safety notes)
├── migrations/
│   └── 0012_dev_grant_aal2.sql           NEW — non-prod RPC for E2E seeding
apps/web/
├── tests/
│   ├── auth-flow.spec.ts                 EDIT — unskip 3 tests + add 2 more
│   ├── authenticated.spec.ts             NEW — Cmd-K + Spotlight find + Admin gate (non-owner)
│   ├── global-setup.ts                   NEW — Supabase admin API: create user, grant AAL2, save storageState
│   └── global-teardown.ts                NEW — delete user + clean any orphaned rows
├── playwright.config.ts                  EDIT — wire globalSetup + globalTeardown + projects
└── package.json                          EDIT — add db:test script
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | pgTAP scaffold + `npm run db:test` script + tests for `household_members` RLS (read own household, no direct insert, update-self-or-owner, owner-only delete) + transactions/bills/categories RLS (read own household only, write own household only). | `supabase/tests/{00_helpers,01_household_members,02_transactions_rls,README}.sql`, `apps/web/package.json` |
| 2 | pgTAP tests for the four admin RPCs (owner-only, last-owner protection, MFA reset removes only verified factors, remove rejects owners). Plus `bill_match_rules` CHECK (category_map without category, name_keyword without keyword), `bills.due_day` CHECK, `create_transfer` pairing invariant, triggers (`handle_new_user` skips null-email, `normalize_email` lowercases, `household_members_update_guard` blocks last-owner demotion). | `supabase/tests/{03_admin_rpcs,04_constraints,05_triggers}.sql` |
| 3 | Migration `0012_dev_grant_aal2.sql` (gated to non-prod). Playwright `globalSetup`/`globalTeardown` + `authenticated.spec.ts`. Unskip the 3 existing skipped tests. Verify all tests + lint + build + Playwright; commit close-out. | `supabase/migrations/0012_dev_grant_aal2.sql`, `apps/web/tests/{global-setup,global-teardown,authenticated}.ts`, `apps/web/tests/auth-flow.spec.ts`, `apps/web/playwright.config.ts` |

## pgTAP harness spec (T1)

### `supabase/tests/00_helpers.sql`

Provides reusable helpers to be `\i`-included by the actual test files:

```sql
-- Wrap all test runs in BEGIN/ROLLBACK so no state escapes.
-- Helper: switch role to authenticated AND set the jwt sub claim.
create or replace function _test.as_user(uid uuid) returns void
  language plpgsql as $$
begin
  set local role authenticated;
  set local request.jwt.claim.sub = uid::text;
  set local request.jwt.claim.aal = 'aal2';
end $$;

-- Helper: switch to anon (no session).
create or replace function _test.as_anon() returns void
  language plpgsql as $$
begin
  set local role anon;
  set local request.jwt.claim.sub to default;
end $$;

-- Plan helper — wraps the test plan declaration.
-- (pgTAP's built-in plan(n) but with auto-finish.)
```

### `supabase/tests/01_household_members.sql`

10–15 assertions in pgTAP's `plan()` block:

- non-member CANNOT `select * from household_members` → 0 rows (RLS hides)
- member can see their own row
- nobody can `insert into household_members` directly (policy "no direct membership insert" blocks)
- member can update their own `display_name` but not their `role` (update guard trigger)
- owner can update another member's `display_name` AND `role`
- last owner cannot demote self (trigger raises)
- owner can `delete from household_members where user_id != self` for members
- owner cannot `delete from household_members where user_id = self` (trigger)
- non-owner cannot delete anything

### `supabase/tests/02_transactions_rls.sql`

For each of `transactions`, `bills`, `categories`, `accounts`, `budgets`, `income_plan`, `bill_match_rules`:

- member can `select` rows where `household_id = lopez`
- member CANNOT `select` rows where `household_id != lopez` (no such row visible)
- non-member CANNOT `select` any row
- member can `insert` a row with their household_id (verify by select-after-insert in same tx)
- non-member CANNOT `insert` (raises permission denied)

## RPC tests (T2)

### `supabase/tests/03_admin_rpcs.sql`

For each of `admin_list_household_users`, `admin_update_household_user`, `admin_reset_user_mfa`, `admin_remove_household_user`:

- as non-member: raises "not authorized: owners only" (or unknown household)
- as member (non-owner): raises "not authorized: owners only"
- as owner with bogus `h_id`: raises "unknown household"
- as owner with valid args: succeeds + side effect verified

Specific RPC contracts:
- `admin_reset_user_mfa` returns count = number of `auth.mfa_factors` rows removed (with status='verified' only — unverified factors untouched)
- `admin_remove_household_user` raises for self-removal AND for target with role='owner'

### `supabase/tests/04_constraints.sql`

- `bill_match_rules` CHECK: insert `(rule_kind='category_map', category=null)` → raises check_violation
- `bill_match_rules` CHECK: insert `(rule_kind='name_keyword', keyword=null)` → raises check_violation
- `bills.due_day` range: insert with `due_day=0` or `due_day=32` → raises check_violation; 1 and 31 succeed
- `transactions` transfer pair: `create_transfer(...)` returns two rows with opposite signs + same transfer_id
- `accounts` starting_balance handling (sanity: row inserts with all required fields)

### `supabase/tests/05_triggers.sql`

- `handle_new_user`: insert into `auth.users` with `email IS NULL` → no row added to `household_members`
- `handle_new_user`: insert into `auth.users` with valid email NOT on the allowlist → no row added
- `handle_new_user`: insert with allowlisted email → row added with role='member' (the seed adds Alexis as owner; other allowlisted users are members)
- `normalize_email` trigger: insert "Foo@Example.COM" → stored as "foo@example.com"
- `household_members_update_guard`: see 01 for last-owner protection coverage

(`handle_new_user` tests require touching `auth.users`, which the test transaction can do under the service role; we'll set `set local role postgres` for these specific cases and ROLLBACK so prod isn't affected.)

## Playwright auth E2E (T3)

### `supabase/migrations/0012_dev_grant_aal2.sql`

```sql
-- Non-prod helper to grant AAL2 to a test user without TOTP setup.
-- Gated by an env-checked GUC so it cannot be invoked in prod.

create or replace function dev_grant_aal2(target_user uuid) returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
begin
  if current_setting('app.environment', true) <> 'test' then
    raise exception 'dev_grant_aal2 is only available in test environments';
  end if;
  -- Insert a synthetic verified TOTP factor.
  insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, secret)
  values (gen_random_uuid(), target_user, 'test-factor', 'totp', 'verified',
          'JBSWY3DPEHPK3PXP'  -- well-known test secret; never exposed
  )
  on conflict do nothing;
end $$;

revoke all on function dev_grant_aal2(uuid) from public;
grant execute on function dev_grant_aal2(uuid) to service_role;
```

This migration is **idempotent and safe** — it raises in prod (where `app.environment` isn't set to `'test'`). For local + CI, the test runner sets `app.environment = 'test'` via a Supabase config or session-level GUC before calling.

### `apps/web/tests/global-setup.ts`

Steps:
1. Read `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` from env (fail fast if missing — print a hint about `.env.test`).
2. Create a unique test user `e2e+${nonce}@test.financehub.local` via `supabase.auth.admin.createUser({ email, password, email_confirm: true })`.
3. Insert a `household_members` row linking the new user to LOPEZ_HOUSEHOLD_ID as `member`.
4. Call `supabase.rpc('dev_grant_aal2', { target_user: user.id })`.
5. Sign in via the Playwright browser using the new credentials, navigate to `/`, save `storageState` to `apps/web/tests/.auth/user.json`.
6. Stash the user id + email in `process.env.E2E_USER_ID` for teardown.

### `apps/web/tests/global-teardown.ts`

Steps:
1. Read `E2E_USER_ID` from env.
2. Delete `household_members` row.
3. Call `supabase.auth.admin.deleteUser(E2E_USER_ID)` (cascades the MFA factor).
4. Best-effort cleanup: any test rows whose household_id is Lopez and were created by this user (defensive — should be none).

### `apps/web/tests/authenticated.spec.ts`

Three tests minimum:
1. **Tab navigation** — visit `/`, click Ledger tab, assert URL `/ledger` and active aria-current="page"
2. **Cmd-K opens spotlight** — dispatch `metaKey+k`, assert dialog visible + input focused
3. **Spotlight jump navigates** — open spotlight, click "Bills" item, assert URL `/bills` and dialog closed

### `apps/web/tests/auth-flow.spec.ts` (edit)

Unskip the 3 existing `test.skip(...)` blocks AND port the bodies above into the new `authenticated.spec.ts` if it makes sense. Either approach works — pick what keeps the file structure clean.

### `playwright.config.ts` (edit)

- Add `globalSetup: './tests/global-setup.ts'`
- Add `globalTeardown: './tests/global-teardown.ts'`
- Add a `projects` block: one project `'anonymous'` (no `storageState`, runs `auth-flow.spec.ts`) and one project `'authenticated'` (uses `storageState`, runs `authenticated.spec.ts`).

## Out of scope

- Running pgTAP in CI (deferred — local manual run is acceptable for a 2-user household; we'll wire CI when GH Actions cost makes sense)
- E2E for **owner** flows (the test user is a member, not an owner — admin RPCs would need a second seeded owner user; defer)
- Property-based tests / fuzz tests
- Load testing (no production traffic concerns at family-scale)
- Visual regression / screenshot diffs
- Lighthouse / performance E2E (`apps/web` is already <300KB on every route)

## Success criteria

- `npm run db:test` runs all five pgTAP files against the dev DB, prints `# All tests successful` (or pgTAP equivalent), `ROLLBACK`s cleanly
- All RLS edge cases asserted (non-member sees nothing, member sees own household, owner-only writes for household_members)
- All admin RPCs fail with the right exception for non-owners
- Last-owner protection trigger fires
- `bill_match_rules` and `bills.due_day` CHECK constraints fire when violated
- `npm run test:e2e --workspace=@financehub/web` runs both projects: anonymous (5 prior tests still pass) + authenticated (3 new tests pass)
- `dev_grant_aal2` is non-prod-only (raises in prod env)
- Test user is created and deleted cleanly; no orphan rows in `household_members` after teardown
- All Vitest tests still pass (557+)
- Build still green
- Lint clean
