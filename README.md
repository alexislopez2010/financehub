# Lopez Family Finances

Private household finance dashboard for the Lopez family. Built on Next.js 15 + Supabase.

## Stack

- **Frontend**: Next.js 15 (App Router, React 19), TypeScript strict, Tailwind v3, Radix primitives, TanStack Query, Vitest, Playwright.
- **Backend**: Supabase (Postgres + Auth + RLS + TOTP MFA).
- **Hosting**: Vercel.

## Repo layout

```
financehub/
├── apps/
│   └── web/                # Next.js 15 app
├── supabase/
│   ├── migrations/         # numeric-prefixed SQL files, applied in order
│   ├── tests/              # pgTAP RLS + RPC + constraint + trigger tests
│   ├── schema.sql          # canonical fresh-install schema
│   └── migrate_from_excel.py
├── scripts/
│   └── db-test.mjs         # runs supabase/tests/*.sql against $SUPABASE_DB_URL
├── docs/
│   ├── CUTOVER.md          # Vercel cutover runbook
│   └── superpowers/
│       ├── specs/          # design specs
│       └── plans/          # implementation plans
├── .github/workflows/ci.yml
├── package.json            # npm workspaces root
└── tsconfig.base.json
```

## Local development

```bash
npm install                                 # bootstrap workspace
npm run dev --workspace=@financehub/web     # start Next.js dev server (or: npm run dev)
```

Required env in `apps/web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Testing

```bash
npm run test --workspace=@financehub/web       # Vitest (unit + component)
npm run test:e2e --workspace=@financehub/web   # Playwright (anonymous flows)
npm run db:test                                # pgTAP RLS + RPC tests (needs SUPABASE_DB_URL)
```

See `apps/web/tests/README.md` for enabling authenticated Playwright tests (needs service-role key).

## Database

Migrations live in `supabase/migrations/` and are applied in numeric order. See `supabase/migrations/README.md` for the runbook + deferred-cleanup notes.

## Adding a household member

Public signups are disabled. To grant a new family member access:

1. Add their email to the allowlist:
   ```sql
   insert into household_signup_allowlist (email, household_id)
     values ('newmember@example.com', '00000000-0000-0000-0000-000000000001');
   ```
2. Invite the user via Supabase Dashboard → Authentication → Users → Invite.
3. They confirm the email, set up TOTP, and land on the dashboard.

To remove access: **first** delete the allowlist row, **then** delete the auth user. Reverse order would briefly allow re-registration.

## Security model

- **Row Level Security** on every table. `is_household_member()` and `is_household_owner()` are the gates, both `SECURITY DEFINER` with pinned `search_path`.
- **MFA (TOTP) required** for every session (AAL2 enforced in Next.js middleware). Fail-closed on MFA-introspection errors.
- Admin RPCs are owner-only at the database layer, not just UI-gated.

See `supabase/migrations/` for the audit trail.

## Architecture

See `docs/superpowers/specs/` for design specs and `docs/superpowers/plans/` for the Phase 2 implementation plans (2A–2O).
