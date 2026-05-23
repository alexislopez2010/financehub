# Financehub Pre-Rewrite Implementation Plan (Phases 0 + 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the live Lopez Family Finances app so the Next.js 15 rewrite (Phase 2) builds on a secure, schema-correct foundation. Close all CRITICAL and HIGH security findings from the review, and add the new schema objects the rewrite depends on — without breaking the running Vite app.

**Architecture:** Two ordered phases applied to the existing repo, both safely additive. Phase 0 = SQL policy and trigger fixes + one JS bugfix; Phase 1 = schema additions (FKs, CHECKs, RPCs, tables) that the legacy app ignores and Phase 2 consumes. No destructive changes (text columns and hardcoded lookups are dropped post-cutover, not now).

**Tech Stack:** PostgreSQL (Supabase), SQL migrations executed via the Supabase SQL Editor, React 18 + Vite (the existing legacy app), `psql` for local verification on a Supabase preview branch.

---

## File Structure

| Path | Status | Responsibility |
|---|---|---|
| `supabase/migrations/0001_household_members_policies.sql` | new | Phase 0.1 — close membership privilege escalation |
| `supabase/migrations/0002_rpcs.sql` | new | Phase 0.2 — version-control `claim_lopez_household` + 4 admin RPCs with owner guards |
| `supabase/migrations/0003_signup_allowlist.sql` | new | Phase 0.3 — harden `handle_new_user` to reject non-allowlisted emails |
| `supabase/migrations/0004_views_security_invoker.sql` | new | Phase 0.4 — recreate `v_monthly_summary` and `v_category_ytd` with RLS-aware semantics |
| `supabase/migrations/0005_pin_search_path.sql` | new | Phase 0.5 — pin `search_path` on `is_household_member` |
| `supabase/migrations/0006_category_id.sql` | new | Phase 1.1 — `transactions.category_id` + `budgets.category_id` FKs, backfilled |
| `supabase/migrations/0007_due_day_check.sql` | new | Phase 1.2 — `CHECK (bills.due_day BETWEEN 1 AND 31)` |
| `supabase/migrations/0008_transfer_pairs.sql` | new | Phase 1.3 — `transactions.transfer_pair_id` + `create_transfer()` RPC |
| `supabase/migrations/0009_bill_match_rules.sql` | new | Phase 1.4 — `bill_match_rules` table seeded from `BILL_TX_MAP` / `BILL_NAME_KW` |
| `supabase/migrations/0010_indexes.sql` | new | Phase 1.5 — missing `household_id` indexes |
| `supabase/migrations/0011_account_balances.sql` | new | Phase 1.6 — `account_balances` snapshot table (Phase 3 will populate) |
| `supabase/schema.sql` | modify | Roll up final state from all migrations |
| `supabase/migrations/README.md` | new | How to run migrations on staging/prod, ordering rules |
| `src/App.jsx:33-36` | modify | Fix password-recovery null-AAL bypass |
| `README.md` | modify | Document the new migration workflow, Supabase signup change |

**Why all additions are non-destructive:** the legacy Vite app currently reads `transactions.category` (text), `transactions.account` (text), the in-component `BILL_TX_MAP`/`BILL_NAME_KW`, and treats transfers as single rows. Phase 1 leaves all those code paths working. Phase 2 will read the new FK columns and the `bill_match_rules` table; the post-cutover cleanup migration drops the legacy text columns then.

---

## Prerequisites (one-time, before Task 1)

- [ ] Create a Supabase **preview branch** off production via the Supabase dashboard → Branches → New branch (`pre-rewrite-staging`). Every migration in this plan runs there first.
- [ ] Confirm `psql` is installed locally: `psql --version` (Postgres 14+). Save the preview-branch connection string into `~/.config/financehub/staging.env` as `STAGING_DB_URL=postgres://...` and source it before each verification step.
- [ ] Snapshot prod via the Supabase dashboard → Database → Backups → take a manual backup. Confirm the backup row appears with today's timestamp before continuing.

---

## Task 1: Set up migrations directory and runbook

**Files:**
- Create: `supabase/migrations/README.md`

- [ ] **Step 1: Create the migrations README**

```markdown
# Supabase migrations

Numeric-prefixed SQL files in this directory are applied **in lexical order**.
The existing `supabase/schema.sql` is the canonical fresh-install schema; it
is updated to reflect the rolled-up state after every migration here.

## How to apply

**Staging (preview branch):**

    source ~/.config/financehub/staging.env
    psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_household_members_policies.sql

**Production:** apply via the Supabase SQL Editor (paste, Run). Always
apply to staging first, smoke-test, then prod. Never edit a migration
file after it has run in production — write a new file instead.

## File naming

    NNNN_short_description.sql

Where NNNN is a four-digit zero-padded ordinal. Files are NOT timestamped
so the order is unambiguous and renames stay impossible.
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/README.md
git commit -m "chore: introduce supabase/migrations directory with runbook"
```

---

## Task 2: Phase 0.1 — `household_members` write policies + update guard

**Why:** Closes the CRITICAL privilege-escalation path — today any authenticated user can `INSERT` themselves into the Lopez household or `UPDATE` their `role` to `'owner'`.

**Files:**
- Create: `supabase/migrations/0001_household_members_policies.sql`
- Modify: `supabase/schema.sql` — append matching block at end of "ROW LEVEL SECURITY" section

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0001_household_members_policies.sql
-- Closes CRITICAL: missing INSERT/UPDATE/DELETE policies on household_members
-- enabled silent privilege escalation. After this migration:
--   * No direct INSERT from clients — only via on_auth_user_created trigger (definer).
--   * UPDATE: a user can update their own row, an owner can update any row.
--   * Changing role requires owner; changing user_id/household_id is forbidden.
--   * DELETE: owner only, and an owner cannot delete themselves.

-- ── helper: is_household_owner() ──────────────────────────────────────
create or replace function is_household_owner(h_id uuid) returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid()
      and household_id = h_id
      and role = 'owner'
  );
$$;

-- ── policies ──────────────────────────────────────────────────────────
drop policy if exists "view own memberships" on household_members;
drop policy if exists "no direct membership insert" on household_members;
drop policy if exists "update self or owner" on household_members;
drop policy if exists "owner deletes member" on household_members;

create policy "view own memberships" on household_members
  for select
  using (user_id = auth.uid() or is_household_member(household_id));

create policy "no direct membership insert" on household_members
  for insert
  with check (false);

create policy "update self or owner" on household_members
  for update
  using (user_id = auth.uid() or is_household_owner(household_id))
  with check (user_id = auth.uid() or is_household_owner(household_id));

create policy "owner deletes member" on household_members
  for delete
  using (is_household_owner(household_id) and user_id <> auth.uid());

-- ── trigger: forbid changing user_id or household_id; non-owners cannot change role ──
create or replace function household_members_update_guard() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
begin
  if old.household_id <> new.household_id then
    raise exception 'household_id is immutable';
  end if;
  if old.user_id <> new.user_id then
    raise exception 'user_id is immutable';
  end if;
  if old.role <> new.role and not is_household_owner(old.household_id) then
    raise exception 'only an owner can change member role';
  end if;
  return new;
end $$;

drop trigger if exists household_members_update_guard on household_members;
create trigger household_members_update_guard
  before update on household_members
  for each row execute function household_members_update_guard();
```

- [ ] **Step 2: Apply to the staging branch**

```bash
source ~/.config/financehub/staging.env
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0001_household_members_policies.sql
```

Expected: `CREATE FUNCTION`, three `CREATE POLICY` lines, `CREATE TRIGGER`. No errors.

- [ ] **Step 3: Verify the privilege-escalation hole is closed**

In the Supabase dashboard SQL Editor (staging branch), find the **"Run as"** dropdown at the top-right and switch from `service_role` to **`authenticated`** with the impersonated user set to a non-owner member (any household_members row with `role = 'member'`). Then run:

```sql
-- Should fail with "new row violates row-level security policy"
insert into household_members (user_id, household_id, role)
  values ('00000000-0000-0000-0000-000000000099',
          '00000000-0000-0000-0000-000000000001',
          'owner');

-- Should fail with "only an owner can change member role"
update household_members set role = 'owner'
  where user_id = auth.uid();
```

Both must error. If either succeeds, **do not proceed** — the migration is broken. Switch the Run-as dropdown back to `service_role` when done.

- [ ] **Step 4: Roll the change into `supabase/schema.sql`**

Open `supabase/schema.sql` and append, immediately after the existing `do $$ ... end $$` policy loop (around line 154), the entire migration body from Step 1 minus the `drop policy if exists` lines.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_household_members_policies.sql supabase/schema.sql
git commit -m "fix(security): close household_members privilege escalation

Adds INSERT (deny-all), UPDATE (self-or-owner), DELETE (owner-only) policies
and an update-guard trigger that forbids changing user_id/household_id and
restricts role changes to owners. Closes the CRITICAL finding from the
pre-rewrite security audit."
```

---

## Task 3: Phase 0.2 — Version-control hidden RPCs with owner guards

**Why:** Five RPCs (`claim_lopez_household`, `admin_list_household_users`, `admin_update_household_user`, `admin_reset_user_mfa`, `admin_remove_household_user`) are called from client code but exist only in the Supabase dashboard. Without explicit `SECURITY DEFINER` + owner check, any household member can call them. We pull each into version control and add a guard.

**Files:**
- Create: `supabase/migrations/0002_rpcs.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Pull current definitions from Supabase**

In the Supabase SQL Editor, for each function name above, run:

```sql
select pg_get_functiondef(oid)
  from pg_proc
  where proname = 'claim_lopez_household';
```

Paste each `pg_get_functiondef` output into a scratchpad. These are the existing implementations. Re-applying them with the guards added is safer than rewriting from scratch.

- [ ] **Step 2: Write the migration**

```sql
-- supabase/migrations/0002_rpcs.sql
-- Version-controls five previously-undocumented RPCs.
-- Each is SECURITY DEFINER with an explicit owner check and a pinned search_path.

-- ── claim_lopez_household — gated, owner-only ──
-- Called from src/hooks/useFinanceData.js on every load. Tightened so it
-- no longer silently joins arbitrary users into the household.
create or replace function claim_lopez_household() returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  -- Idempotent: if the caller is already a member, no-op.
  if exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = v_household_id
  ) then
    return;
  end if;

  -- Otherwise refuse. Membership is granted only by handle_new_user
  -- (signup trigger) or by an owner via admin_update_household_user.
  raise exception 'not authorized: contact a household owner';
end $$;

-- ── admin_list_household_users ──
create or replace function admin_list_household_users()
  returns table (
    user_id uuid,
    email text,
    display_name text,
    role text,
    mfa_factors int,
    joined_at timestamptz
  )
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;

  return query
    select hm.user_id,
           u.email::text,
           hm.display_name,
           hm.role,
           (select count(*)::int
              from auth.mfa_factors f
              where f.user_id = hm.user_id and f.status = 'verified'),
           hm.joined_at
    from household_members hm
    join auth.users u on u.id = hm.user_id
    where hm.household_id = v_household_id
    order by hm.joined_at;
end $$;

-- ── admin_update_household_user(target_user uuid, new_role text, new_display_name text) ──
create or replace function admin_update_household_user(
  target_user uuid,
  new_role text default null,
  new_display_name text default null
) returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if new_role is not null and new_role not in ('owner','member') then
    raise exception 'invalid role: %', new_role;
  end if;

  update household_members
     set role = coalesce(new_role, role),
         display_name = coalesce(new_display_name, display_name)
   where user_id = target_user
     and household_id = v_household_id;
end $$;

-- ── admin_reset_user_mfa(target_user uuid) — wipe verified TOTP factors ──
create or replace function admin_reset_user_mfa(target_user uuid)
  returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if not exists (
    select 1 from household_members
    where user_id = target_user and household_id = v_household_id
  ) then
    raise exception 'user is not a member of this household';
  end if;

  delete from auth.mfa_factors where user_id = target_user;
end $$;

-- ── admin_remove_household_user(target_user uuid) ──
create or replace function admin_remove_household_user(target_user uuid)
  returns void
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  if not is_household_owner(v_household_id) then
    raise exception 'not authorized: owners only';
  end if;
  if target_user = auth.uid() then
    raise exception 'owners cannot remove themselves; transfer ownership first';
  end if;

  delete from household_members
    where user_id = target_user and household_id = v_household_id;
end $$;

-- ── Lock down direct EXECUTE; only authenticated callers via RPC ──
revoke all on function claim_lopez_household() from public;
revoke all on function admin_list_household_users() from public;
revoke all on function admin_update_household_user(uuid, text, text) from public;
revoke all on function admin_reset_user_mfa(uuid) from public;
revoke all on function admin_remove_household_user(uuid) from public;

grant execute on function claim_lopez_household() to authenticated;
grant execute on function admin_list_household_users() to authenticated;
grant execute on function admin_update_household_user(uuid, text, text) to authenticated;
grant execute on function admin_reset_user_mfa(uuid) to authenticated;
grant execute on function admin_remove_household_user(uuid) to authenticated;
```

- [ ] **Step 3: Apply to staging and verify owner guards**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0002_rpcs.sql
```

Then, signed in as a non-owner test user (use the Supabase JS client in a one-shot Node script), call each admin RPC:

```js
const { error } = await supabase.rpc('admin_list_household_users')
console.log(error)  // should be "not authorized: owners only"
```

All four admin RPCs must reject the non-owner. `claim_lopez_household` must reject a user who is not already a member.

- [ ] **Step 4: Roll into `supabase/schema.sql`**

Append the entire migration body to the end of `supabase/schema.sql`, before the closing comment block.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_rpcs.sql supabase/schema.sql
git commit -m "fix(security): version-control admin RPCs with owner guards

Pulls claim_lopez_household and four admin_* RPCs out of the Supabase
dashboard into supabase/migrations/0002_rpcs.sql. Each now has an
explicit is_household_owner() check, a pinned search_path, and
EXECUTE granted only to authenticated. Closes CRITICAL finding from
the security review."
```

---

## Task 4: Phase 0.3 — Disable open signup + add allowlist to `handle_new_user`

**Why:** Today, anyone who reaches the Vercel URL can sign up and get auto-joined to the Lopez household. Two-layer fix: turn off Supabase's public signup, and harden the trigger so even if it were enabled it rejects non-allowlisted emails.

**Files:**
- Create: `supabase/migrations/0003_signup_allowlist.sql`
- Modify: `supabase/schema.sql`
- Modify: `README.md` — document the dashboard setting + how to add allowlisted emails

- [ ] **Step 1: In the Supabase dashboard**

Project → Authentication → Providers → Email → toggle **"Enable signups"** off. Save.

- [ ] **Step 2: Write the trigger migration**

```sql
-- supabase/migrations/0003_signup_allowlist.sql
-- Even with public signups disabled, harden handle_new_user so that any
-- new auth.users row whose email is not in the allowlist does NOT get
-- joined to the household. Owners maintain the allowlist via SQL.

create table if not exists household_signup_allowlist (
  email text primary key,
  household_id uuid not null references households(id),
  added_by uuid references auth.users(id),
  added_at timestamptz default now()
);

alter table household_signup_allowlist enable row level security;

drop policy if exists "owner manages allowlist" on household_signup_allowlist;
create policy "owner manages allowlist" on household_signup_allowlist
  for all using (is_household_owner(household_id))
  with check (is_household_owner(household_id));

-- Seed Alexis + Marilyn (replace emails before running)
insert into household_signup_allowlist (email, household_id)
  values ('alexis.hiram@gmail.com', '00000000-0000-0000-0000-000000000001'),
         ('marilyn@example.com',    '00000000-0000-0000-0000-000000000001')
  on conflict (email) do nothing;

-- Rewrite the trigger to enforce the allowlist
create or replace function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_household_id uuid;
begin
  select household_id into v_household_id
    from household_signup_allowlist
    where lower(email) = lower(new.email);

  if v_household_id is null then
    -- Not allowlisted. Leave the auth.users row alone — no household join.
    return new;
  end if;

  insert into household_members (user_id, household_id, display_name, role)
    values (
      new.id,
      v_household_id,
      coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
      case
        when (select count(*) from household_members where household_id = v_household_id) = 0
        then 'owner' else 'member'
      end
    );
  return new;
end $$;

-- Trigger itself is unchanged but recreate defensively
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- [ ] **Step 3: Edit the seed emails**

Open `supabase/migrations/0003_signup_allowlist.sql` and replace `marilyn@example.com` with Marilyn's actual email. Double-check `alexis.hiram@gmail.com` is correct.

- [ ] **Step 4: Apply to staging and verify**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0003_signup_allowlist.sql
```

Then, in the staging Supabase dashboard, create a test user with a non-allowlisted email (e.g., `test-intruder@example.com`). Verify:

```sql
-- The user exists in auth.users…
select id, email from auth.users where email = 'test-intruder@example.com';
-- …but NOT in household_members
select * from household_members
  where user_id = (select id from auth.users where email = 'test-intruder@example.com');
```

The first query returns one row; the second returns zero. Delete the test user from staging when done.

- [ ] **Step 5: Update `README.md`**

In `README.md`, under "Phase 1 setup", find step 7 ("Add Marilyn") and replace it with:

```markdown
### 7. Add a household member

Public signups are disabled. To add a new family member:

1. Add their email to the allowlist:
   ```sql
   insert into household_signup_allowlist (email, household_id)
     values ('newmember@example.com', '00000000-0000-0000-0000-000000000001');
   ```
2. Invite the user via the Supabase dashboard → Authentication → Users → Invite.
3. They confirm the email, set up TOTP, and land on the dashboard.

To remove access: delete them from Supabase dashboard → Authentication → Users
*and* remove their row from `household_signup_allowlist`.
```

- [ ] **Step 6: Roll into `schema.sql` and commit**

Append the migration body to `supabase/schema.sql` (after the previous additions).

```bash
git add supabase/migrations/0003_signup_allowlist.sql supabase/schema.sql README.md
git commit -m "fix(security): require email allowlist for household join

Disables Supabase public signups and adds household_signup_allowlist.
handle_new_user now refuses to add any new auth user whose email isn't
on the allowlist for the household. Closes the open-signup-auto-join
exposure from the security review."
```

---

## Task 5: Phase 0.4 — Recreate views with RLS-aware semantics

**Why:** `v_monthly_summary` and `v_category_ytd` were created with `security definer` semantics (the default), so they bypass RLS. Recreate with `security_invoker = true` so they inherit the calling user's row-visibility.

**Files:**
- Create: `supabase/migrations/0004_views_security_invoker.sql`
- Modify: `supabase/schema.sql:184-209`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0004_views_security_invoker.sql
-- Postgres 15+ supports WITH (security_invoker = true) on views so RLS
-- evaluates as the caller, not the view owner. Without this, views over
-- RLS-protected tables silently leak cross-household data.

drop view if exists v_monthly_summary;
create view v_monthly_summary
  with (security_invoker = true) as
select
  household_id,
  date_trunc('month', date)::date as month,
  sum(case when type = 'Income'  then amount else 0 end) as income,
  sum(case when type = 'Expense' then amount else 0 end) as expenses,
  sum(case when type = 'Refund'  then amount else 0 end) as refunds,
  sum(case when type = 'Income'  then amount else 0 end)
    - sum(case when type = 'Expense' then amount else 0 end)
    + sum(case when type = 'Refund'  then amount else 0 end) as net_cash_flow,
  count(*) filter (where type = 'Expense') as expense_count,
  count(*) filter (where type = 'Income')  as income_count
from transactions
group by household_id, date_trunc('month', date);

drop view if exists v_category_ytd;
create view v_category_ytd
  with (security_invoker = true) as
select
  household_id,
  extract(year from date)::int as year,
  category,
  type,
  sum(amount) as total,
  count(*)    as txn_count
from transactions
where category is not null
group by household_id, extract(year from date), category, type;
```

- [ ] **Step 2: Apply and verify isolation**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0004_views_security_invoker.sql
```

Create a second-household test user in staging (manually `insert into households` + `household_members` via service role). Sign in as that user via the Supabase JS client and run:

```js
const { data } = await supabase.from('v_monthly_summary').select('*')
console.log(data)   // must be [] — no Lopez rows leaked
```

If `data` contains Lopez rows, the view is still definer-bound — investigate.

- [ ] **Step 3: Update `supabase/schema.sql`**

Replace the existing `create or replace view v_monthly_summary` and `create or replace view v_category_ytd` blocks (around lines 184–209) with the `drop view if exists` + `create view ... with (security_invoker = true)` form from the migration.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_views_security_invoker.sql supabase/schema.sql
git commit -m "fix(security): make summary views RLS-aware

Recreate v_monthly_summary and v_category_ytd with
WITH (security_invoker = true) so RLS evaluates as the calling user
instead of the view owner. Closes HIGH finding from security review."
```

---

## Task 6: Phase 0.5 — Pin `search_path` on `is_household_member`

**Why:** `is_household_member` is `SECURITY DEFINER` but lacks `SET search_path`. A user with create-rights in a non-public schema could shadow the `household_members` table.

**Files:**
- Create: `supabase/migrations/0005_pin_search_path.sql`
- Modify: `supabase/schema.sql:127-133`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0005_pin_search_path.sql
-- Pins search_path on the existing SECURITY DEFINER helper so the
-- function always resolves `household_members` from `public`,
-- never from a user-controlled schema.

create or replace function is_household_member(h_id uuid) returns boolean
  language sql security definer stable
  set search_path = public, pg_temp
as $$
  select exists (
    select 1 from household_members
    where user_id = auth.uid() and household_id = h_id
  );
$$;
```

- [ ] **Step 2: Apply and verify the existing functionality still works**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0005_pin_search_path.sql
```

Confirm with `psql`:
```sql
select prosecdef, proconfig from pg_proc where proname = 'is_household_member';
-- prosecdef should be t; proconfig should contain "search_path=public, pg_temp"
```

- [ ] **Step 3: Update `supabase/schema.sql`**

Replace the existing `is_household_member` definition (around lines 127–133) with the migration body. Also pin `search_path` on the existing `handle_new_user` if not already done in Task 4 (it was — verify it's there).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_pin_search_path.sql supabase/schema.sql
git commit -m "fix(security): pin search_path on is_household_member

Adds SET search_path = public, pg_temp to the SECURITY DEFINER helper
so it cannot be tricked into resolving household_members from a
user-controlled schema. Closes MEDIUM finding from security review."
```

---

## Task 7: Phase 0.6 — Fix password-recovery null-AAL bypass

**Why:** `App.jsx:33-36` treats a null `aalData` (network failure on the MFA check) as "MFA not required," letting a recovery-token holder skip MFA. Fix: fail closed.

**Files:**
- Modify: `src/App.jsx:30-36`

- [ ] **Step 1: Edit `src/App.jsx`**

Replace the block at lines 30–36:

```jsx
        // Detect whether MFA step-up is required to update password
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
          setRecoveryAal2(false)
        } else {
          setRecoveryAal2(true) // no MFA required — skip straight to reset form
        }
```

with:

```jsx
        // Detect whether MFA step-up is required. Default to requiring MFA
        // if the check fails or returns null — fail closed, never open.
        let mustChallenge = true
        try {
          const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
          if (aalErr || !aalData) {
            mustChallenge = true
          } else if (aalData.currentLevel === 'aal2') {
            mustChallenge = false   // already stepped up
          } else if (aalData.nextLevel !== 'aal2') {
            mustChallenge = false   // no MFA enrolled at all — no factor to challenge
          } else {
            mustChallenge = true    // aal1 with aal2 available — must step up
          }
        } catch {
          mustChallenge = true      // any error → fail closed
        }
        setRecoveryAal2(!mustChallenge)
```

- [ ] **Step 2: Manual smoke test**

`npm run dev`. From the login screen, click "Forgot password," enter your email, follow the link from the email. Confirm:
- If you have TOTP enrolled, you see the MFA challenge before the new-password form.
- If you complete TOTP successfully, the reset form loads.
- If you intentionally type the wrong TOTP code three times, you cannot reach the reset form.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "fix(security): fail closed on password-recovery MFA check

Treats a null or errored getAuthenticatorAssuranceLevel response as
'MFA required' instead of 'MFA not required.' Closes HIGH finding from
the security review: a transient Supabase error during PASSWORD_RECOVERY
previously routed the user past the MFA challenge."
```

---

## Task 8: Deploy Phase 0 to production

- [ ] **Step 1: Re-confirm staging is green** — every Task 2–7 verification step passed on the preview branch.

- [ ] **Step 2: Merge to `main`** (PR review optional since you're the sole maintainer — but a PR forces a CI pass)

```bash
git push origin main
```

- [ ] **Step 3: Apply migrations to production in order**

In the Supabase SQL Editor, paste each file in turn and Run:
1. `supabase/migrations/0001_household_members_policies.sql`
2. `supabase/migrations/0002_rpcs.sql`
3. `supabase/migrations/0003_signup_allowlist.sql`
4. `supabase/migrations/0004_views_security_invoker.sql`
5. `supabase/migrations/0005_pin_search_path.sql`

Stop and investigate immediately on any error. Migrations are non-destructive — you can re-run any of them safely.

- [ ] **Step 4: Disable public signups in production**

Production Supabase dashboard → Authentication → Providers → Email → Enable signups → off.

- [ ] **Step 5: Smoke test production**

- Visit `https://financehub-flame.vercel.app`, log in, complete MFA, land on Dashboard. Confirm transactions, bills, budgets still load.
- Forgot-password flow: request a reset, follow the link, MFA challenge appears.
- Sign out and attempt to sign up with a non-allowlisted email — the dashboard should show "Signups are disabled."

- [ ] **Step 6: Tag the milestone**

```bash
git tag -a phase-0-complete -m "Phase 0 security hotfixes shipped to prod"
git push origin phase-0-complete
```

---

## Task 9: Phase 1.1 — Add `category_id` FK to `transactions` and `budgets`

**Why:** Today's text-based `category` column means renames silently orphan history. Phase 2 reads `category_id` directly; Phase 1 adds the column and backfills it while keeping the text column live so the legacy Vite app keeps working.

**Files:**
- Create: `supabase/migrations/0006_category_id.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0006_category_id.sql
-- Phase 1.1 — add transactions.category_id and budgets.category_id as
-- nullable FKs to categories.id. Backfill from the existing text columns.
-- The text columns are NOT dropped here; the legacy app still reads them.
-- Phase 2's cleanup migration drops them post-cutover.

alter table transactions
  add column if not exists category_id uuid references categories(id) on delete set null;

alter table budgets
  add column if not exists category_id uuid references categories(id) on delete set null;

-- Backfill: match on (household_id, name, type) for transactions
-- transactions.type is 'Expense'/'Income'/'Transfer'/'Refund' but
-- categories.type is 'expense'/'income' (lowercase, only two values).
-- Map Income→income, everything else→expense for matching purposes.
update transactions t
   set category_id = c.id
  from categories c
 where t.category_id is null
   and t.category is not null
   and c.household_id = t.household_id
   and c.name = t.category
   and c.type = case when t.type = 'Income' then 'income' else 'expense' end;

-- Budgets always represent expense categories
update budgets b
   set category_id = c.id
  from categories c
 where b.category_id is null
   and b.category is not null
   and c.household_id = b.household_id
   and c.name = b.category
   and c.type = 'expense';

-- Index the new FK columns for join performance
create index if not exists transactions_category_id_idx
  on transactions(household_id, category_id);
create index if not exists budgets_category_id_idx
  on budgets(household_id, category_id);
```

- [ ] **Step 2: Apply to staging and verify backfill coverage**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0006_category_id.sql
```

Run coverage queries:
```sql
-- How many transactions still have a text category but no FK match?
select count(*) from transactions
  where category is not null and category_id is null;

-- How many budgets?
select count(*) from budgets
  where category is not null and category_id is null;
```

Both counts should be near 0. Investigate any unmatched rows — they probably reference a category name that doesn't exist in the `categories` table. Either insert the missing category and re-run the UPDATEs, or accept the orphans (they'll be flagged in Phase 2 as "uncategorized" and remediated in the UI).

- [ ] **Step 3: Roll into `supabase/schema.sql`**

Add `category_id uuid references categories(id) on delete set null` to the `transactions` and `budgets` table definitions. Add the two indexes.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0006_category_id.sql supabase/schema.sql
git commit -m "feat(schema): add category_id FK on transactions and budgets

Adds nullable category_id columns referencing categories(id), backfilled
from the existing text columns. Text columns remain live so the legacy
app keeps working; Phase 2 reads category_id, post-cutover cleanup drops
the text columns."
```

---

## Task 10: Phase 1.2 — `bills.due_day` CHECK constraint

**Why:** Months shorter than 31 days produced recurring clamping bugs in the legacy app. The CHECK encodes the invariant in the schema; application code still clamps to actual month length at query time.

**Files:**
- Create: `supabase/migrations/0007_due_day_check.sql`
- Modify: `supabase/schema.sql:86-98`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0007_due_day_check.sql
-- Phase 1.2 — enforce 1 ≤ due_day ≤ 31 at the schema level.
-- App code is still responsible for clamping to actual month length
-- (e.g. day=31 on Feb → 28/29), but no row can ever store 0, 32, or NULL.

-- Defensive backfill in case any out-of-range rows exist
update bills set due_day = least(greatest(due_day, 1), 31)
  where due_day is not null and (due_day < 1 or due_day > 31);

alter table bills
  add constraint bills_due_day_range check (due_day is null or (due_day between 1 and 31));
```

- [ ] **Step 2: Apply and verify**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0007_due_day_check.sql
psql "$STAGING_DB_URL" -c "select id, name, due_day from bills where due_day < 1 or due_day > 31;"
# Expected: 0 rows
```

Try inserting an out-of-range row as a sanity check:
```sql
insert into bills (household_id, name, due_day)
  values ('00000000-0000-0000-0000-000000000001', 'test', 99);
-- Expected: ERROR: new row violates check constraint "bills_due_day_range"
```

- [ ] **Step 3: Update `supabase/schema.sql`**

In the `bills` table definition, change `due_day int,` to `due_day int check (due_day is null or (due_day between 1 and 31)),`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0007_due_day_check.sql supabase/schema.sql
git commit -m "feat(schema): constrain bills.due_day to 1..31

Adds CHECK constraint encoding the invariant the legacy app kept
breaking. App code still clamps to actual month length at query time."
```

---

## Task 11: Phase 1.3 — `transfer_pair_id` + `create_transfer()` RPC

**Why:** Single-row transfers can't reconcile cross-account balances. Add the pair column + an atomic RPC so Phase 2 can write paired rows; historical single-row transfers are migrated during Phase 2 (not here — splitting them now would confuse the legacy app, which doesn't know about pairs).

**Files:**
- Create: `supabase/migrations/0008_transfer_pairs.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0008_transfer_pairs.sql
-- Phase 1.3 — add the column + RPC. Historical single-row transfers
-- are NOT split here; that backfill runs as part of Phase 2 startup so
-- the legacy Vite app keeps its current view of transfers (single row).

alter table transactions
  add column if not exists transfer_pair_id uuid references transactions(id) on delete set null;

create index if not exists transactions_transfer_pair_idx
  on transactions(household_id, transfer_pair_id)
  where transfer_pair_id is not null;

-- Atomic two-row insert. Both legs share a fresh transfer_pair_id (= the
-- id of the source-leg row) so they can be collapsed in the UI.
create or replace function create_transfer(
  p_household_id    uuid,
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric,
  p_date            date,
  p_description     text default 'Transfer',
  p_member          text default null
) returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_pair_id uuid;
  v_from_name text;
  v_to_name text;
begin
  if not is_household_member(p_household_id) then
    raise exception 'not authorized';
  end if;
  if p_amount <= 0 then
    raise exception 'transfer amount must be positive';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'source and destination accounts must differ';
  end if;

  select name into v_from_name from accounts
    where id = p_from_account_id and household_id = p_household_id;
  select name into v_to_name from accounts
    where id = p_to_account_id and household_id = p_household_id;
  if v_from_name is null or v_to_name is null then
    raise exception 'invalid account ids for this household';
  end if;

  -- Source leg (debit)
  insert into transactions (
    household_id, date, description, amount, type, account, member
  ) values (
    p_household_id, p_date,
    coalesce(p_description, 'Transfer') || ' → ' || v_to_name,
    -abs(p_amount), 'Transfer', v_from_name, p_member
  )
  returning id into v_pair_id;

  update transactions set transfer_pair_id = v_pair_id where id = v_pair_id;

  -- Destination leg (credit)
  insert into transactions (
    household_id, date, description, amount, type, account, member, transfer_pair_id
  ) values (
    p_household_id, p_date,
    coalesce(p_description, 'Transfer') || ' ← ' || v_from_name,
    abs(p_amount), 'Transfer', v_to_name, p_member, v_pair_id
  );

  return v_pair_id;
end $$;

revoke all on function create_transfer(uuid, uuid, uuid, numeric, date, text, text) from public;
grant execute on function create_transfer(uuid, uuid, uuid, numeric, date, text, text) to authenticated;
```

- [ ] **Step 2: Apply and verify atomicity**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0008_transfer_pairs.sql
```

Get two account UUIDs from staging:
```bash
psql "$STAGING_DB_URL" -c "select id, name from accounts where household_id = '00000000-0000-0000-0000-000000000001' limit 2;"
```

Then call the RPC via the Supabase SQL Editor (Run as `authenticated`, impersonated as any household member), substituting the two UUIDs:

```sql
select create_transfer(
  '00000000-0000-0000-0000-000000000001'::uuid,   -- household_id
  '<first-account-uuid>'::uuid,                    -- p_from_account_id
  '<second-account-uuid>'::uuid,                   -- p_to_account_id
  100,                                             -- p_amount
  '2026-05-23'::date                               -- p_date
);
```

The returned UUID is the `transfer_pair_id`. Verify the pair:
```sql
select id, account, amount, transfer_pair_id
  from transactions
  where transfer_pair_id = '<returned-uuid>';
-- Expected: 2 rows; one amount=-100 on the source account, one amount=+100 on the destination
```

Negative test: try amount = 0, or same account on both sides — both must error.

- [ ] **Step 3: Update `supabase/schema.sql`** — append the `transfer_pair_id` column to the `transactions` definition, plus the index and the function.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_transfer_pairs.sql supabase/schema.sql
git commit -m "feat(schema): add transfer_pair_id + create_transfer() RPC

Phase 2 will write paired transfer rows via this RPC and migrate
historical single-row transfers at startup. Legacy app continues to
treat transfers as single rows (transfer_pair_id stays null on those)."
```

---

## Task 12: Phase 1.4 — `bill_match_rules` table

**Why:** Today's `BILL_TX_MAP` and `BILL_NAME_KW` are hardcoded in `Dashboard.jsx:2124-2175`. Move to a real table that Phase 2 reads from and the Admin UI can edit.

**Files:**
- Create: `supabase/migrations/0009_bill_match_rules.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0009_bill_match_rules.sql
psql "$STAGING_DB_URL" -c "select rule_kind, count(*) from bill_match_rules group by rule_kind;"
# Expected: name_keyword | 28-ish, category_map | 35-ish
```

Run a coverage check:
```sql
-- How many seeded rows didn't resolve to a real bills.id?
select bill_name from bill_match_rules
  where bill_id is null
  group by bill_name
  order by bill_name;
```

Any bill_name in the output is a rule for a bill that doesn't exist in `bills` yet — that's fine for legacy seed rows (`Gifts`, `Gym/Fitness`, etc. that are "category buckets," not single bills). Confirm none of them are actual missing bills the user expected to see.

- [ ] **Step 3: Update `supabase/schema.sql`** — append the table definition, indexes, and policies (skip the seed rows in the canonical schema file — those are migration-specific).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0009_bill_match_rules.sql supabase/schema.sql
git commit -m "feat(schema): externalise bill match rules into bill_match_rules

Migrates the hardcoded BILL_TX_MAP and BILL_NAME_KW from Dashboard.jsx
into a real table. Phase 2 reads from this table and the Admin UI can
edit it; the legacy app keeps its hardcoded copy until cutover."
```

---

## Task 13: Phase 1.5 — Missing `household_id` indexes

**Why:** Postgres doesn't auto-index FK columns. Per-household queries (the entire app) scan unnecessarily.

**Files:**
- Create: `supabase/migrations/0010_indexes.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0010_indexes.sql
-- Phase 1.5 — explicit household_id indexes on per-household tables
-- whose only existing indexes are PKs or RLS-helper-irrelevant.

create index if not exists categories_household_idx on categories(household_id);
create index if not exists bills_household_idx on bills(household_id);
create index if not exists budgets_household_idx on budgets(household_id);
create index if not exists family_members_household_idx on family_members(household_id);
create index if not exists accounts_household_idx on accounts(household_id);
```

- [ ] **Step 2: Apply and verify**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0010_indexes.sql
psql "$STAGING_DB_URL" -c "select indexname from pg_indexes where indexname like '%household%' order by indexname;"
```

Spot-check a query plan:
```sql
explain select * from categories where household_id = '00000000-0000-0000-0000-000000000001';
-- Expect: Index Scan using categories_household_idx
```

- [ ] **Step 3: Update `supabase/schema.sql`** — append the five `create index` statements.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0010_indexes.sql supabase/schema.sql
git commit -m "perf(schema): add explicit household_id indexes

Postgres doesn't auto-index FK columns; per-household queries (the
entire app) were doing seq scans on small tables. Now indexed."
```

---

## Task 14: Phase 1.6 — `account_balances` snapshot table

**Why:** Phase 3 (net worth over time) needs daily account-balance snapshots. Create the table now (empty) so Phase 2 can start writing to it incrementally.

**Files:**
- Create: `supabase/migrations/0011_account_balances.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0011_account_balances.sql
-- Phase 1.6 — table to hold per-account daily balance snapshots.
-- Stays empty in Phase 2; Phase 3 starts populating it via a cron job
-- and a one-time backfill from transaction history.

create table if not exists account_balances (
  account_id uuid references accounts(id) on delete cascade not null,
  household_id uuid references households(id) on delete cascade not null,
  as_of date not null,
  balance numeric(14,2) not null,
  source text not null default 'derived' check (source in ('derived','manual','imported')),
  created_at timestamptz default now(),
  primary key (account_id, as_of)
);

create index if not exists account_balances_household_date_idx
  on account_balances(household_id, as_of desc);

alter table account_balances enable row level security;

drop policy if exists "household read balances" on account_balances;
drop policy if exists "household write balances" on account_balances;
create policy "household read balances" on account_balances
  for select using (is_household_member(household_id));
create policy "household write balances" on account_balances
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));
```

- [ ] **Step 2: Apply and verify**

```bash
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/0011_account_balances.sql
psql "$STAGING_DB_URL" -c "\d account_balances"
```

Should show the table with PK `(account_id, as_of)`, two indexes, RLS enabled.

- [ ] **Step 3: Update `supabase/schema.sql`** — append the table definition, index, and policies.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0011_account_balances.sql supabase/schema.sql
git commit -m "feat(schema): add account_balances snapshot table

Empty in Phase 2 — Phase 3 (net worth over time) starts populating it.
Created now so the data model is in place before the rewrite ships."
```

---

## Task 15: Deploy Phase 1 to production + close out

- [ ] **Step 1: Re-verify staging is clean** — every Task 9–14 verification step passed.

- [ ] **Step 2: Push `main`**

```bash
git push origin main
```

- [ ] **Step 3: Apply Phase 1 migrations to production in order**

In the Supabase SQL Editor:
6. `supabase/migrations/0006_category_id.sql`
7. `supabase/migrations/0007_due_day_check.sql`
8. `supabase/migrations/0008_transfer_pairs.sql`
9. `supabase/migrations/0009_bill_match_rules.sql`
10. `supabase/migrations/0010_indexes.sql`
11. `supabase/migrations/0011_account_balances.sql`

Stop on the first error. All are idempotent (`if not exists` everywhere) so re-runs are safe.

- [ ] **Step 4: Production smoke test**

Visit `https://financehub-flame.vercel.app`, complete MFA, and verify the live app is unchanged:
- Transactions tab loads and edits work
- Budget tab loads, editing budget lines persists
- Bills tab loads with correct due-day display
- Adding a new transaction still works
- The CFO and Obligations tabs still load

If any tab errors, **roll back by re-running the previous schema state** — but the Phase 1 changes are all additive, so this should not happen. Investigate any error before continuing.

- [ ] **Step 5: Coverage sanity check on production**

In the Supabase SQL Editor:
```sql
-- All transactions and budgets should have category_id set for known categories
select count(*) filter (where category_id is null) as missing,
       count(*) as total
  from transactions
  where category is not null;

select count(*) from bill_match_rules where household_id = '00000000-0000-0000-0000-000000000001';
-- Should match staging numbers
```

- [ ] **Step 6: Tag the milestone**

```bash
git tag -a phase-1-complete -m "Phase 1 schema migrations shipped to prod"
git push origin phase-1-complete
```

- [ ] **Step 7: Final spec/plan trace**

Open `docs/superpowers/specs/2026-05-23-financehub-rewrite-design.md` and check off the Section 6 items:

```
[x] Phase 0.1 household_members policies
[x] Phase 0.2 hidden RPCs version-controlled with owner guards
[x] Phase 0.3 public signup disabled + allowlist
[x] Phase 0.4 views security_invoker
[x] Phase 0.5 search_path pinned
[x] Phase 0.6 password recovery null-AAL fix
[x] Phase 1.1 category_id FKs
[x] Phase 1.2 due_day CHECK
[x] Phase 1.3 transfer_pair_id + create_transfer
[x] Phase 1.4 bill_match_rules
[x] Phase 1.5 household_id indexes
[x] Phase 1.6 account_balances table
```

This unblocks Phase 2 (the rewrite). Spec is ready to drive the next plan.

---

## Success Criteria

Pre-rewrite is complete when:
- `phase-0-complete` and `phase-1-complete` git tags are pushed
- All 11 migration files have run on production without errors
- The legacy Vite app at `https://financehub-flame.vercel.app` is unchanged from the user's perspective (same data, same tabs, same UI)
- The CRITICAL/HIGH findings from the security review are closed:
  - No way for any authenticated user to self-join the household or escalate to owner
  - Admin RPCs reject non-owners server-side
  - Public signup is disabled
  - Views inherit RLS
  - Password recovery requires MFA
- Phase 2 can begin building against the new FK columns, `bill_match_rules`, `create_transfer()`, and `account_balances` without further schema changes

The Phase 2 rewrite plan (`2026-MM-DD-financehub-rewrite.md`) is written after this plan is approved.
