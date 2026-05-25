# Cutover runbook

Steps to flip production from the retired Vite app to the Next.js rewrite. Estimated time: ~10 minutes including post-deploy smoke checks.

## Pre-flight (already done — verify)

- [x] All Vitest tests green (557 passing)
- [x] pgTAP suite green (72 assertions)
- [x] Anonymous Playwright tests green (12/12)
- [x] Production build green
- [x] `apps/legacy/` removed from the repo
- [x] Phase 2N database cleanup applied (advisor ERROR=0)
- [ ] Branch `phase-2-rewrite` merged to `main`

## Vercel dashboard steps (manual, ~5 min)

1. Open [Vercel Dashboard](https://vercel.com/) → Project → **Settings → General**
2. Edit "Root Directory":
   - **Before**: `apps/legacy`
   - **After**: `apps/web`
3. Confirm "Build Command" auto-detects as `next build` (or set to `npm run build`)
4. Confirm "Output Directory" auto-detects (Next.js: `.next` — leave default)
5. Confirm "Install Command" auto-detects as `npm install` (workspaces handled automatically)
6. Open **Settings → Environment Variables**. Ensure these are set for `Production`:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (`https://euemewcdrdiloddlrywm.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon (publishable) key (from Dashboard → Settings → API)
7. Open **Deployments** → trigger a fresh build from `main` (the new Root Directory only takes effect on the next deploy)

## Post-deploy smoke check (~5 min on the production URL)

- [ ] `/login` renders the form
- [ ] Sign in → MFA challenge → home (`/`) loads with KPI tiles
- [ ] Five tabs accessible: Briefing · Ledger · Plan · Bills · Accounts
- [ ] Spotlight (⌘K / Ctrl+K) opens and shows Jump items
- [ ] `/admin` loads for the owner (Alexis)
- [ ] `/admin` redirects non-owners (Marilyn) to `/`
- [ ] Sign out clears session and returns to `/login`

## Rollback (if anything breaks)

1. Vercel Dashboard → Deployments → previous deployment from before cutover
2. Click ⋯ → **Promote to Production**
3. Revert "Root Directory" back to `apps/legacy` in Settings (so future deploys also revert)
4. Note: `apps/legacy/` no longer lives in the current branch — to actually rebuild the old app you'd need to deploy from the `phase-1-complete` tag instead. **The previous Vercel deployment artifact is your real rollback path; the source tree is gone.**

## Post-cutover (when satisfied)

```bash
git tag phase-2-complete
git push --tags
```

Update Supabase Dashboard:

- [ ] Toggle "Leaked Password Protection" ON (Auth → Passwords)

## What's deferred (post-cutover work, see `supabase/migrations/README.md`)

- Drop `transactions.category` + `bills.category` text columns once new app reads `category_id` everywhere
- Reconstruct the 42 legacy single-row Transfer rows (manual UI cleanup)
- Move advisor views to a private schema to stop PostgREST exposure
- 22 remaining `security_definer_function_executable` advisor WARNs — review GRANTs
