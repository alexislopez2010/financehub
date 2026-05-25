# Phase 2O — Cutover

> Subagent-driven; ~2 dispatches.

**Goal:** Retire `apps/legacy/`, make `apps/web/` the sole production app, tag `phase-2-complete`. The Vercel project re-pointing is a one-click task in the Vercel dashboard (user does it; we prep the repo).

## What changes in the repo

- `apps/legacy/` removed (including its `dist/`, `node_modules/`, source)
- Root `package.json` — `dev:legacy` / `build:legacy` scripts removed
- Root `README.md` — collapsed to describe the single `apps/web` app
- `supabase/migrate_from_excel.py` retained (one-time importer for legacy data, still useful as documentation)
- `supabase/schema.sql` retained (canonical fresh-install schema)
- `tsconfig.base.json` retained

## What the user changes outside the repo

- Vercel Dashboard → Project Settings → Root Directory: `apps/legacy` → `apps/web`
- Vercel Dashboard → Project Settings → Build Command: confirm `next build` (auto-detected) or set explicitly
- Vercel Dashboard → Environment Variables: confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for production
- Vercel Dashboard → Domains: confirm production domain points at the new deployment

We provide a `CUTOVER.md` runbook so the user has a step-by-step checklist.

## File structure

```
apps/
└── web/                      Only app remaining
docs/
└── CUTOVER.md                NEW — Vercel dashboard checklist + rollback plan
package.json                  EDIT — remove :legacy scripts
README.md                     EDIT — describe single-app layout
.gitignore                    Possibly trim apps/legacy/ entries
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Delete `apps/legacy/` directory. Update root `package.json` (remove `dev:legacy` + `build:legacy`). Rewrite `README.md` to reflect the new single-app layout. Trim `.gitignore` of any `apps/legacy/*`-specific entries. Verify Vitest + Playwright + build still pass. | `apps/legacy/` (delete), `package.json`, `README.md`, `.gitignore` |
| 2 | Write `docs/CUTOVER.md` runbook (Vercel dashboard steps + rollback). Final smoke check: build green, all tests pass. Commit close-out. Tag `phase-2-complete`. | `docs/CUTOVER.md` |

## Detailed specs

### T1 — Remove `apps/legacy/`

Order of operations:
1. **Verify nothing in the repo still imports from `apps/legacy/`** — `grep -rn 'apps/legacy' . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.md"` (excluding node_modules + the .git dir). Expected hits: the deleted `package.json` workspace pattern, `README.md`, plan docs. The plan docs are historical and can stay.
2. **Delete the directory:** `git rm -r apps/legacy`. Yes, this is destructive — but the legacy app's history stays in git for archaeology if ever needed.
3. **Update `package.json`:**
   - Remove `"dev:legacy"` and `"build:legacy"` script entries
   - The `"workspaces": ["apps/*"]` glob can stay — it'll just match `apps/web` going forward
4. **Update root `README.md`:** rewrite to describe the new layout. Single-app description, no "mid-rewrite" framing. Keep references to `supabase/`, `docs/`, `.github/workflows/`.
5. **Verify:**
   ```
   npm install   # confirm workspaces still resolves cleanly
   npm run lint --workspace=@financehub/web
   npm run test --workspace=@financehub/web
   npm run build --workspace=@financehub/web
   npm run test:e2e --workspace=@financehub/web    # anonymous project; 12/12 expected
   ```
6. Commit:
   ```
   chore: retire apps/legacy — single-app monorepo

   Removes apps/legacy/ (the Vite app the rewrite replaced). Updates root
   package.json + README to reflect the new layout. Vercel project's
   Root Directory needs to flip from apps/legacy to apps/web — see
   docs/CUTOVER.md.
   ```

### T2 — `docs/CUTOVER.md`

Step-by-step checklist for the user to execute against the Vercel dashboard:

```md
# Cutover runbook

## Pre-flight (in the repo, automated)

- [x] All Vitest tests green
- [x] Anonymous Playwright tests green
- [x] Build green
- [x] apps/legacy/ removed
- [x] Branch phase-2-rewrite merged to main

## Vercel dashboard steps (manual, ~5 min)

1. Open Vercel → Project → Settings → General
2. Edit "Root Directory":
   - Before: `apps/legacy`
   - After: `apps/web`
3. Confirm Build Command auto-detects as `next build` (or set to `npm run build`)
4. Confirm Output Directory auto-detects (Next.js: `.next`)
5. Open Settings → Environment Variables. Ensure these are set for `Production`:
   - `NEXT_PUBLIC_SUPABASE_URL` (Supabase project URL)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Supabase publishable/anon key)
6. Open Deployments → trigger a fresh build from `main` (the new Root Directory only takes effect on the next deploy)
7. Once deployed, smoke-test on the production URL:
   - `/login` renders
   - Sign in → MFA challenge → home
   - All five tabs load without errors
   - Spotlight (Cmd-K) opens
   - `/admin` redirects non-owners and loads for the owner

## Rollback (if something breaks)

1. Vercel Dashboard → Deployments → previous deployment from before cutover
2. Click "..." → "Promote to Production"
3. Revert "Root Directory" back to `apps/legacy` in Settings (so future deploys go back to legacy)
4. File an issue: what broke, what env var was missing, what selector changed

## Post-cutover

- Tag the commit: `git tag phase-2-complete`
- Push: `git push --tags`
- Verify `https://<production-domain>` shows the new app
```

After writing `CUTOVER.md`, run all tests + build one final time as a verification gate, then commit:

```
docs: add Phase 2O cutover runbook + tag phase-2-complete

Final close-out for the Phase 2 rewrite. Documents the manual Vercel
dashboard steps needed to point production at apps/web. Includes a
rollback path in case something breaks post-cutover.
```

Then tag:

```
git tag phase-2-complete
```

(The user pushes the tag themselves when they're ready.)

## Success criteria

- `apps/legacy/` no longer exists in the repo
- `npm install` runs clean from the repo root
- All Vitest + Playwright anonymous tests pass
- Build green
- `docs/CUTOVER.md` exists with a complete runbook
- `phase-2-complete` tag created locally (push deferred to user)

## Out of scope

- Actually flipping the Vercel project (user's call, one click)
- Custom domain DNS changes
- Decommissioning the Supabase project (still needed — both apps share it)
- Removing the legacy git history (preserved for archaeology)
