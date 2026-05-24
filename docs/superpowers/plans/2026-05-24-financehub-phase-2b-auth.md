# Phase 2B — Auth flow + Middleware

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Wire Supabase auth into `apps/web` end-to-end — server-side client, Next.js middleware that enforces session + AAL2, the auth route group (`login`, `forgot-password`, `reset-password`, `mfa/enroll`, `mfa/challenge`, `signup`), and a placeholder `(app)` layout with a profile menu shell so authenticated users land somewhere coherent.

**Architecture:** `@supabase/ssr` for cookie-based session management. Three Supabase client factories: server (RSC), browser (client components), middleware (cookie refresh). Middleware runs on every protected route, redirects unauth → `/login`, AAL1-without-AAL2 → `/mfa/challenge`. Fail-closed everywhere — MFA introspection errors route to challenge, not dashboard. Auth pages use the editorial primitives from 2A; no app chrome.

**Tech Stack:** Next.js 15 middleware, `@supabase/ssr`, `@supabase/supabase-js`, React Hook Form (for typed forms with validation), Zod (schemas).

---

## File structure (target end-state of 2B)

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              # bare editorial shell (no app chrome)
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── signup/page.tsx         # "signups are disabled" message
│   │   └── mfa/
│   │       ├── enroll/page.tsx
│   │       └── challenge/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx              # placeholder shell with profile menu
│   │   └── page.tsx                # placeholder briefing
│   └── auth/
│       └── callback/route.ts       # OAuth/recovery email callback
├── components/
│   └── auth/
│       ├── LoginForm.tsx
│       ├── MfaEnrollForm.tsx
│       ├── MfaChallengeForm.tsx
│       ├── ForgotPasswordForm.tsx
│       ├── ResetPasswordForm.tsx
│       └── ProfileMenu.tsx
├── lib/
│   ├── supabase/
│   │   ├── server.ts               # createServerClient (cookie-aware)
│   │   ├── browser.ts              # createBrowserClient
│   │   └── middleware.ts           # session refresh helper used by middleware.ts
│   └── auth/
│       └── aal.ts                  # AAL helpers: requireAal2(), mustChallenge()
├── middleware.ts                   # root middleware enforcing auth
└── .env.local.example
```

---

## Task list

| # | Task | Files touched |
|---|---|---|
| 1 | Install `@supabase/ssr`, `react-hook-form`, `zod`, `@hookform/resolvers`. Add `.env.local.example`. Build the three Supabase client factories + `lib/auth/aal.ts`. | `apps/web/lib/supabase/*`, `apps/web/lib/auth/aal.ts`, `.env.local.example` |
| 2 | Root `middleware.ts` — refresh session on every request; redirect unauth → `/login`; AAL1 → `/mfa/challenge`; honor `?next=` round-trips. Allow auth routes through unguarded. | `apps/web/middleware.ts` |
| 3 | `(auth)/layout.tsx` + `LoginForm` + `/login/page.tsx`. Includes email/password validation via Zod + React Hook Form. Submit calls Supabase, redirects to `?next=` or `/`. Error display inline. | `apps/web/app/(auth)/layout.tsx`, `apps/web/app/(auth)/login/page.tsx`, `apps/web/components/auth/LoginForm.tsx` |
| 4 | MFA enroll page + form. Shows QR + manual-entry secret + 6-digit verify input. On success: redirect to `/`. Vitest: form validation + state transitions. | `apps/web/app/(auth)/mfa/enroll/page.tsx`, `apps/web/components/auth/MfaEnrollForm.tsx` + tests |
| 5 | MFA challenge page + form. 6-digit input, verify against the user's enrolled factor, on success refresh session + redirect. Honors `?next=`. | `apps/web/app/(auth)/mfa/challenge/page.tsx`, `apps/web/components/auth/MfaChallengeForm.tsx` + tests |
| 6 | Forgot password (request reset email) + Reset password (set new password). Auth callback route `/auth/callback` handles the recovery code exchange. Signup page shows "signups are disabled" message. | `apps/web/app/(auth)/forgot-password/page.tsx`, `apps/web/app/(auth)/reset-password/page.tsx`, `apps/web/app/(auth)/signup/page.tsx`, `apps/web/app/auth/callback/route.ts` + forms + tests |
| 7 | `(app)/layout.tsx` shell with a `<ProfileMenu>` placeholder (renders user email + Logout button using Supabase signOut). `/` placeholder briefing page that says "Authenticated as <email>" so we can visually confirm the middleware works. Playwright: full login flow against the staging Supabase. | `apps/web/app/(app)/layout.tsx`, `apps/web/app/(app)/page.tsx`, `apps/web/components/auth/ProfileMenu.tsx`, `apps/web/tests/auth.spec.ts` |

---

## Environment

`.env.local.example` (committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
```

For dev, copy to `apps/web/.env.local` and fill in the live values from the Financehub Supabase project. Same values the legacy app uses.

---

## Success criteria

- Visiting any `(app)` route while logged out redirects to `/login`.
- Login with valid credentials redirects to `/` or `?next=` target.
- Login when MFA is required routes to `/mfa/challenge`.
- Successful MFA verification then routes to the original target.
- Password recovery email flow works: forgot → email → reset → MFA challenge (if enrolled) → password update → login.
- "Signups are disabled" message renders on `/signup`.
- Authenticated home shows "Authenticated as <email>" + a Logout button that signs out and redirects to `/login`.
- All Vitest tests green; new Playwright test for auth flow green (against staging or with the Supabase URL/key in CI secrets — defer the CI side).

---

## Out of scope (later sub-phases)

- App shell with bottom-tab nav + spotlight bar (2C)
- The 5 surfaces (2F–2J)
- Owner-gated admin (2L)
- pgTAP schema tests (2M)
