# Lopez Family Finances

Private household finance dashboard for the Lopez family. Currently in mid-rewrite:

- **`apps/legacy/`** — the original React + Vite app, live in production.
- **`apps/web/`** — the in-progress Next.js 15 + TypeScript rewrite (Phase 2). Not yet deployed; cut over at the end of Phase 2.

Both apps talk to the same Supabase project. Schema lives in [`supabase/`](./supabase/).

## Stack

- **Frontend (web/)**: Next.js 15 (App Router, React 19), TypeScript strict, Tailwind v3, Radix primitives, TanStack Query (to be added), Vitest, Playwright.
- **Frontend (legacy/)**: React 18 + Vite + Tailwind. Maintenance only.
- **Backend**: Supabase (Postgres + Auth + RLS + TOTP MFA).
- **Hosting**: Vercel.

## Repo layout

```
financehub/
├── apps/
│   ├── legacy/             # current Vite app (still production)
│   └── web/                # new Next.js 15 app (rewrite in progress)
├── supabase/
│   ├── migrations/         # numeric-prefixed SQL files, applied in order
│   ├── schema.sql          # canonical fresh-install schema
│   └── migrate_from_excel.py
├── docs/superpowers/
│   ├── specs/              # design specs
│   └── plans/              # implementation plans
├── .github/workflows/ci.yml
├── package.json            # npm workspaces root
└── tsconfig.base.json      # shared TypeScript compiler options
```

## Local development

```bash
# Install everything (both workspaces)
npm install

# Run the legacy Vite app on :5173
npm run dev:legacy

# Run the new Next.js app on :3000
npm run dev:web

# Build either
npm run build:legacy
npm run build:web

# Workspace-wide
npm run lint        # ESLint where configured
npm run test        # Vitest where configured
npm run typecheck   # tsc --noEmit where configured
```

Both apps need a Supabase URL + anon key. Each has its own `.env`:

```
apps/legacy/.env       VITE_SUPABASE_URL=...      VITE_SUPABASE_ANON_KEY=...
apps/web/.env.local    NEXT_PUBLIC_SUPABASE_URL=…  NEXT_PUBLIC_SUPABASE_ANON_KEY=…  (added in Phase 2B)
```

## Phase 2 progress

- [x] **Phase 0** — security hotfixes (privilege escalation, admin RPC owner guards, signup allowlist, RLS-aware views, search_path pinning, password-recovery null-AAL fix). Tagged `phase-0-complete`.
- [x] **Phase 1** — schema additions (category_id FKs, due_day CHECK, transfer_pair_id + create_transfer RPC, bill_match_rules, household_id indexes, account_balances). Tagged `phase-1-complete`.
- [ ] **Phase 2** — Next.js 15 rewrite. In progress on branch `phase-2-rewrite`.
  - [x] 2A — monorepo + scaffold + design system
  - [ ] 2B — auth flow + middleware
  - [ ] 2C — app shell + bottom-tab nav + spotlight bar
  - [ ] 2D — `lib/finance/*` pure modules + 100% unit coverage
  - [ ] 2E — TanStack Query data layer
  - [ ] 2F — Briefing surface
  - [ ] 2G — Ledger surface
  - [ ] 2H — Plan surface
  - [ ] 2I — Bills surface
  - [ ] 2J — Accounts surface
  - [ ] 2K — Spotlight search (Cmd-K)
  - [ ] 2L — Admin
  - [ ] 2M — Playwright E2E + pgTAP schema tests
  - [ ] 2N — Cleanup migrations (transfer-row split, drop legacy text columns)
  - [ ] 2O — Cutover (Vercel branch merge, decommission Vite)

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
- **MFA (TOTP) required** for every session (AAL2 enforced in `apps/legacy/src/App.jsx` and — in Phase 2B — Next.js middleware). Fail-closed on MFA-introspection errors.
- Admin RPCs are owner-only at the database layer, not just UI-gated.

See `supabase/migrations/` for the audit trail.
