// supabase/functions/add-household-member/index.ts
//
// Edge Function that lets a household owner add a new member.
//
// Flow:
//   1. Verify the caller's bearer JWT and create a caller-scoped Supabase
//      client (RLS applies).
//   2. Validate the request body (household_id, email, display_name, role).
//   3. Confirm the caller is an OWNER of the target household by reading
//      household_members under the caller's session.
//   4. Use a service-role client (NEVER exposed to the browser) to:
//        a. Generate a 16-char random password (ambiguous chars excluded).
//        b. Call auth.admin.createUser with email_confirm: true.
//        c. Insert the household_members row.
//        d. Roll back the auth user if the insert fails.
//   5. Return { user_id, email, initial_password, display_name, role }.
//      The password is shown to the admin exactly once; it is not logged.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are
// auto-injected by the Supabase Edge runtime.
//
// Deno runtime — uses Deno.serve and Deno.env.

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
  initial_password: string
  display_name: string
  role: string
}

// CORS origin allowlist. Defense-in-depth on top of the JWT + owner checks:
// only same-project origins may read this function's responses from a browser.
// - Production custom domain
// - Vercel preview deploys for this project (financehub-*.vercel.app)
// - Localhost for dev
const STATIC_ALLOWED_ORIGINS = new Set<string>([
  'https://financehub-flame.vercel.app',
  'http://localhost:3000'
])
const PREVIEW_ORIGIN_RE = /^https:\/\/financehub-[a-z0-9-]+\.vercel\.app$/

function resolveAllowedOrigin(reqOrigin: string | null): string {
  if (reqOrigin && (STATIC_ALLOWED_ORIGINS.has(reqOrigin) || PREVIEW_ORIGIN_RE.test(reqOrigin))) {
    return reqOrigin
  }
  // Fall back to the canonical production origin. A disallowed origin gets a
  // mismatched ACAO header, so the browser blocks it from reading the response.
  return 'https://financehub-flame.vercel.app'
}

Deno.serve(async (req) => {
  const allowOrigin = resolveAllowedOrigin(req.headers.get('Origin'))

  // CORS headers reused on every response. Vary: Origin so caches don't serve
  // one origin's ACAO to another.
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Vary': 'Origin'
  }

  // Local error helper closes over the per-request CORS headers.
  function jsonError(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonError(405, 'method not allowed')
  }

  // 1. Verify caller's session
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'missing bearer token')
  }
  const callerJwt = authHeader.slice('Bearer '.length)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonError(500, 'server misconfigured: missing supabase env')
  }

  // Caller-scoped client — RLS applies via the bearer token.
  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } }
  })

  // 2. Parse + validate body
  let body: Partial<AddMemberRequest>
  try {
    body = (await req.json()) as Partial<AddMemberRequest>
  } catch {
    return jsonError(400, 'invalid json body')
  }

  if (!body.household_id || !body.email || !body.display_name || !body.role) {
    return jsonError(400, 'missing required field')
  }
  if (body.role !== 'owner' && body.role !== 'member') {
    return jsonError(400, 'role must be owner or member')
  }
  if (!isLikelyEmail(body.email)) {
    return jsonError(400, 'invalid email')
  }

  // 3. Verify caller is an OWNER of this household.
  // The caller-scoped client + RLS means a caller who isn't a member of the
  // household sees zero rows here, which we treat as "not authorized".
  const { data: callerMembership, error: membershipErr } = await callerClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.household_id)
    .maybeSingle()

  if (membershipErr) return jsonError(500, membershipErr.message)
  if (!callerMembership || callerMembership.role !== 'owner') {
    return jsonError(403, 'only owners can add members')
  }

  // 4. Service-role client for privileged ops (creating auth users +
  //    bypassing RLS for the insert).
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 5. Generate a secure random password.
  const initialPassword = generatePassword()

  // 6. Create the auth user. email_confirm: true skips the confirmation
  //    email so the new member can sign in immediately with the password
  //    the admin reads to them out of band.
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: initialPassword,
    email_confirm: true
  })

  if (createErr || !created.user) {
    return jsonError(400, createErr?.message ?? 'failed to create user')
  }

  // 7. Insert household_members row.
  const { error: insertErr } = await adminClient
    .from('household_members')
    .insert({
      household_id: body.household_id,
      user_id: created.user.id,
      role: body.role,
      display_name: body.display_name
    })

  if (insertErr) {
    // Roll back the auth user so we don't leave an orphan account behind.
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
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
})

function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function generatePassword(): string {
  // 16 chars. Ambiguous chars (0/O, 1/l/I) excluded so the admin can read
  // the password out loud without confusion. Includes a few safe symbols
  // to meet typical password-strength requirements.
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}
