# Phase 3D — Admin: Add household member

> Subagent-driven; ~2 dispatches.

**Goal:** Owner can add a new family member directly from `/admin` → Members. No Supabase Dashboard trip required. Fills the gap left by Phase 2L where List/Edit/Reset-MFA/Remove shipped but Add did not (because signup is disabled by design).

**Architecture:** Supabase Edge Function (`add-household-member`) holds the service-role key server-side. Authenticated browser call → Edge Function verifies caller is a household owner → creates the auth user via `supabase.auth.admin.createUser` (auto-confirms email, generates random initial password) → inserts `household_members` row → returns the generated password to the caller. Dialog shows the password once with a copy-to-clipboard button; admin tells the new member their email + password verbally / out of band. On first login the new member hits the existing `/mfa/enroll` middleware redirect and sets up TOTP.

**Why Edge Function instead of a Postgres RPC:**
- Creating an auth.users entry from Postgres requires bypassing Supabase's email-confirmation + password-hashing pipeline. Sharp tool.
- Service-role key MUST NEVER appear in the browser bundle.
- Supabase's documented pattern for admin user creation is `auth.admin.createUser` via a server-side function.

## File structure

```
supabase/
└── functions/
    └── add-household-member/
        └── index.ts                  Edge Function (Deno runtime)

apps/web/
├── lib/data/
│   ├── admin.ts                      EDIT — add useAddHouseholdMember mutation hook
│   └── admin.test.tsx                EDIT — add tests for the new hook
└── components/admin/members/
    ├── AddMemberDialog.tsx           NEW — Radix Dialog with email + name + role form
    ├── AddMemberDialog.test.tsx
    └── MembersSection.tsx            EDIT — add "+ Add member" button in section header
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Edge Function `add-household-member` deployed to prod via MCP. `useAddHouseholdMember` mutation hook in `lib/data/admin.ts` (calls `supabase.functions.invoke`). Tests. | `supabase/functions/add-household-member/index.ts`, `apps/web/lib/data/admin.ts`, `apps/web/lib/data/admin.test.tsx` |
| 2 | `AddMemberDialog.tsx` — email + display name + role form, calls the mutation, shows generated password once with copy button. Wire "+ Add member" button into `MembersSection.tsx` header. Smoke tests. Final verify + commit. | `components/admin/members/AddMemberDialog.tsx`, `components/admin/members/MembersSection.tsx`, tests |

## Edge Function spec (T1)

### `supabase/functions/add-household-member/index.ts`

Deno runtime. Uses the Supabase Edge Function pattern:

```ts
// supabase/functions/add-household-member/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2'

interface AddMemberRequest {
  household_id: string
  email: string
  display_name: string
  role: 'owner' | 'member'
}

interface AddMemberResponse {
  user_id: string
  email: string
  initial_password: string  // returned only here, never persisted
  display_name: string
  role: string
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type'
      }
    })
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method not allowed')
  }

  // 1. Verify caller's session
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'missing bearer token')
  }
  const callerJwt = authHeader.slice('Bearer '.length)

  // Create a client that runs with the CALLER's session (RLS applies)
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${callerJwt}` } } }
  )

  // 2. Parse + validate body
  const body = (await req.json()) as Partial<AddMemberRequest>
  if (!body.household_id || !body.email || !body.display_name || !body.role) {
    return jsonError(400, 'missing required field')
  }
  if (body.role !== 'owner' && body.role !== 'member') {
    return jsonError(400, 'role must be owner or member')
  }
  if (!isLikelyEmail(body.email)) {
    return jsonError(400, 'invalid email')
  }

  // 3. Verify caller is an OWNER of this household
  const { data: callerMembership, error: membershipErr } = await callerClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.household_id)
    .maybeSingle()
  if (membershipErr) return jsonError(500, membershipErr.message)
  if (!callerMembership || callerMembership.role !== 'owner') {
    return jsonError(403, 'only owners can add members')
  }

  // 4. Use service-role for the privileged ops
  const adminClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 5. Generate a secure random password
  const initialPassword = generatePassword()

  // 6. Create auth user (auto-confirms email so they can sign in immediately)
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: initialPassword,
    email_confirm: true
  })
  if (createErr || !created.user) {
    return jsonError(400, createErr?.message ?? 'failed to create user')
  }

  // 7. Insert household_members row
  const { error: insertErr } = await adminClient
    .from('household_members')
    .insert({
      household_id: body.household_id,
      user_id: created.user.id,
      role: body.role,
      display_name: body.display_name
    })

  if (insertErr) {
    // Roll back the auth user so we don't leave an orphan
    await adminClient.auth.admin.deleteUser(created.user.id)
    return jsonError(500, insertErr.message)
  }

  const response: AddMemberResponse = {
    user_id: created.user.id,
    email: body.email,
    initial_password: initialPassword,
    display_name: body.display_name,
    role: body.role
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
})

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function generatePassword(): string {
  // 16 chars, alphanumeric + a few safe symbols
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => charset[b % charset.length]).join('')
}
```

Notes:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are all auto-injected by Supabase Edge runtime; you don't need to set them.
- The roll-back on insert-failure prevents orphaned auth users.
- The CORS handler is permissive (`*`) because all calls come from the app's same Vercel origin; Supabase's own auth gating means a hostile origin still needs a valid bearer token to do anything.

### Deploy via MCP

Use `mcp__106e39ab-..._deploy_edge_function` with:
- `name: 'add-household-member'`
- `files: [{ name: 'index.ts', content: <the source above> }]`

Verify with `mcp__106e39ab-..._list_edge_functions` (or `get_edge_function`).

### Mutation hook (T1)

```ts
// apps/web/lib/data/admin.ts

export interface AddHouseholdMemberArgs {
  email: string
  displayName: string
  role: 'owner' | 'member'
}

export interface AddHouseholdMemberResult {
  userId: string
  email: string
  initialPassword: string
  displayName: string
  role: string
}

export function useAddHouseholdMember(): UseMutationResult<
  AddHouseholdMemberResult, Error, AddHouseholdMemberArgs, never
> {
  const queryClient = useQueryClient()
  return useMutation({
    async mutationFn(args) {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('add-household-member', {
        body: {
          household_id: LOPEZ_HOUSEHOLD_ID,
          email: args.email,
          display_name: args.displayName,
          role: args.role
        }
      })
      if (error) throw error
      const payload = data as {
        user_id: string
        email: string
        initial_password: string
        display_name: string
        role: string
      }
      return {
        userId: payload.user_id,
        email: payload.email,
        initialPassword: payload.initial_password,
        displayName: payload.display_name,
        role: payload.role
      }
    },
    onSuccess() {
      // Refetch the members list so the new row appears
      void queryClient.invalidateQueries({ queryKey: ['admin', 'household_members'] })
    }
  })
}
```

Tests: mock `supabase.functions.invoke`, verify happy path + error path + cache-invalidation on success.

## Dialog spec (T2)

### `AddMemberDialog.tsx`

Radix Dialog. Two states:

**State 1: Form**
- Email input (required)
- Display name input (required)
- Role select: Member / Owner (default Member)
- Cancel / Add member buttons
- Inline error display if mutation fails

**State 2: Success — show the generated password**
- Big banner: "Member added"
- Email + Display name + Role shown read-only
- A `<code>` block with the initial password, plus a Copy button (uses `navigator.clipboard.writeText`)
- A warning callout: "Save this password now — it's shown only once. The new member should change it on first login."
- A "Done" button closes the dialog. Closing also triggers a refetch (already wired via `onSuccess`).

### Wire into MembersSection

In the section header, next to the "X members in this household" text:

```tsx
<button
  onClick={() => setShowAdd(true)}
  className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg transition"
>
  <UserPlus size={14} />
  Add member
</button>
```

`<AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} />` at the bottom alongside the other dialogs.

## Success criteria

- Owner-only: Member-role users can use the dialog but get a 403 from the Edge Function ("only owners can add members"). The dialog surfaces the error.
- Email validation rejects malformed addresses client-side AND server-side
- Created auth user can immediately sign in with email + the generated password
- On first login, middleware redirects to `/mfa/enroll`; after enrollment they land in the app under the household
- If the household_members insert fails (e.g. uniqueness violation), the auth user is rolled back
- Tests: mocked happy path + error path + cache invalidation; dialog smoke test renders form + transitions to success state

## Security considerations

- Service-role key NEVER leaves the Edge runtime
- Caller must present a valid bearer JWT (Supabase auto-validates via the function runtime)
- Caller's owner-status is verified by querying `household_members` under the caller's session (so RLS applies and the caller can't lie about their role)
- Generated password uses Web Crypto (`crypto.getRandomValues`)
- Password is returned exactly once and not logged on the server side
- The auth user is created with `email_confirm: true` because the admin is vouching for the new user (alternative is to use Supabase's invite email, which is a different UX flow — out of scope)

## Out of scope

- Email invitation with magic-link signup (Option 3 from the scoping discussion — bigger build, defer)
- Admin can SET a custom initial password (we always generate)
- Bulk add (CSV upload of multiple members) — defer
- Self-service signup for non-allowlisted emails (deliberately disabled by Phase 2B.T6)
- Re-sending the initial password if lost (admin can use the existing Reset MFA flow + Supabase Dashboard to reset password)
