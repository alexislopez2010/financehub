# Playwright E2E

Two projects: **`anonymous`** (runs without a session) and **`authenticated`**
(runs with a service-role-provisioned session).

## Running

```bash
# Both projects (authenticated will skip if not configured — see below):
npm run test:e2e --workspace=@financehub/web

# Anonymous only (no setup needed):
npm run test:e2e --workspace=@financehub/web -- --project=anonymous

# Authenticated only (requires SUPABASE_SERVICE_ROLE_KEY):
npm run test:e2e --workspace=@financehub/web -- --project=authenticated
```

## Authenticated project setup

The `authenticated` project requires the Supabase **service role** key so
`global-setup.ts` can:

1. Create a unique test user (`e2e+<nonce>@test.financehub.local`)
2. Link the user to the Lopez household as a `member`
3. Call the test-only RPC `dev_grant_aal2` to attach a synthetic verified
   TOTP factor (see migration `0012_dev_grant_aal2.sql`)
4. Drive a browser to `/login`, submit the credentials, satisfy the MFA
   challenge using a TOTP code derived from the well-known test secret,
   and save the resulting session cookies to `tests/.auth/user.json`

When the key is **absent**, `global-setup.ts` logs a clear "skipping
authenticated setup" message and sets `E2E_AUTH_AVAILABLE=0`. Every test
in `authenticated.spec.ts` then marks itself `test.skip()` via a
`beforeAll` guard, so the anonymous suite still runs cleanly.

### Enabling it locally

1. Find the service role key in **Supabase Dashboard → Project Settings → API**
   (it's labeled `service_role` `secret`).
2. Create `apps/web/.env.test` (gitignored):

   ```bash
   # apps/web/.env.test
   SUPABASE_SERVICE_ROLE_KEY=<paste-the-secret-here>
   # NEXT_PUBLIC_SUPABASE_URL is read from .env.local automatically;
   # override here only if you need to point at a different project.
   ```

3. Run `npm run test:e2e --workspace=@financehub/web`. You should see:

   ```
   [e2e] Provisioned test user e2e+...@test.financehub.local (<uuid>)
   ...
   [e2e] Cleaned up test user <uuid>
   ```

### Safety

- **`.env.test` is gitignored.** Never commit the service role key.
- The service role key bypasses RLS. Treat it like a database password —
  never paste it into chat, screenshots, or third-party tooling.
- `global-teardown.ts` deletes the test user (and cascades MFA factors)
  after every run. Orphan rows are not expected; if you see one, delete
  manually via the Supabase dashboard.
- The `dev_grant_aal2` RPC is gated: it raises in any environment where
  `app.environment ≠ 'test'` AND the caller is not `service_role`. In
  production no caller ever satisfies either branch, so the function is
  effectively dead code there.

## File layout

```
tests/
├── README.md                this file
├── .auth/                   gitignored — runtime storageState
│   └── user.json            placeholder + overwritten by globalSetup
├── global-setup.ts          provisions test user
├── global-teardown.ts       deletes test user
├── smoke.spec.ts            anonymous: design-system page renders
├── auth-flow.spec.ts        anonymous: auth redirects + form rendering
└── authenticated.spec.ts    authenticated: shell, Cmd-K, spotlight jump
```
