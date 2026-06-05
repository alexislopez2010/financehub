// supabase/functions/reset-household-member-password/index.ts
//
// Admin-initiated password reset for a household member. Generates a
// Supabase recovery link and triggers the recovery email — the member
// clicks the link, lands on /reset-password, and sets a new password.
//
// Authorization model mirrors add-household-member:
//   - Bearer JWT identifies the caller
//   - Caller must be an OWNER of the target household
//   - Target user must be an active member of the same household
//
// This does NOT change the user's password directly. Supabase sends the
// recovery email; the user controls the new password through the recovery
// link. That keeps the new password out of admin hands by design.
//
// SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are auto-injected.

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface ResetRequest {
  household_id: string
  target_user_id: string
}

interface ResetResponse {
  ok: true
  email: string
}

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  'https://financehub-flame.vercel.app',
  'http://localhost:3000'
])
const PREVIEW_ORIGIN_RE = /^https:\/\/financehub-[a-z0-9-]+\.vercel\.app$/

function resolveAllowedOrigin(reqOrigin: string | null): string {
  if (reqOrigin && (STATIC_ALLOWED_ORIGINS.has(reqOrigin) || PREVIEW_ORIGIN_RE.test(reqOrigin))) {
    return reqOrigin
  }
  return 'https://financehub-flame.vercel.app'
}

Deno.serve(async (req) => {
  const allowOrigin = resolveAllowedOrigin(req.headers.get('Origin'))
  // Echo back the requested headers so the supabase-js client's additional
  // headers (apikey, x-client-info, x-supabase-api-version, …) pass the
  // preflight without us having to enumerate them. Fall back to the
  // explicit minimal set when the browser didn't ask for any.
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders ?? 'authorization, content-type, apikey, x-client-info',
    'Vary': 'Origin, Access-Control-Request-Headers'
  }
  function jsonError(status: number, message: string): Response {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonError(405, 'method not allowed')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return jsonError(401, 'missing bearer token')
  const callerJwt = authHeader.slice('Bearer '.length)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonError(500, 'server misconfigured: missing supabase env')
  }

  let body: Partial<ResetRequest>
  try {
    body = (await req.json()) as Partial<ResetRequest>
  } catch {
    return jsonError(400, 'invalid json body')
  }
  if (!body.household_id || !body.target_user_id) return jsonError(400, 'missing required field')

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } }
  })

  // Resolve the caller's user id from the JWT so we can scope the caller
  // membership lookup to a single row. Without this, a household with
  // multiple owners returns multiple rows from RLS and .maybeSingle() blows
  // up with PGRST116 ("multiple (or no) rows returned").
  const { data: callerAuth, error: callerAuthErr } = await callerClient.auth.getUser()
  if (callerAuthErr || !callerAuth.user) {
    return jsonError(401, `caller auth failed: ${callerAuthErr?.message ?? 'no user'}`)
  }
  const callerUserId = callerAuth.user.id

  // Caller must be an owner of the target household.
  const { data: callerMembership, error: callerErr } = await callerClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.household_id)
    .eq('user_id', callerUserId)
    .maybeSingle()
  if (callerErr) return jsonError(500, `callerCheck: ${callerErr.message}`)
  if (!callerMembership || callerMembership.role !== 'owner') {
    return jsonError(403, 'only owners can reset member passwords')
  }

  // Target must be a member of the same household — verified via the
  // caller's RLS view so we don't leak existence of arbitrary user ids.
  const { data: targetMembership, error: targetErr } = await callerClient
    .from('household_members')
    .select('user_id')
    .eq('household_id', body.household_id)
    .eq('user_id', body.target_user_id)
    .maybeSingle()
  if (targetErr) return jsonError(500, targetErr.message)
  if (!targetMembership) return jsonError(404, 'target is not a member of this household')

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // Look up the target user's email so we can pass it to generateLink.
  const { data: userInfo, error: userErr } = await adminClient.auth.admin.getUserById(body.target_user_id)
  if (userErr || !userInfo.user?.email) {
    console.error('reset-password: getUserById failed', { userErr, has_user: !!userInfo?.user })
    return jsonError(500, `getUserById: ${userErr?.message ?? 'target user has no email on file'}`)
  }
  const targetEmail = userInfo.user.email

  // Generate a recovery link. Supabase sends the email automatically via
  // the project's GoTrue email config; the link drops the user onto
  // /reset-password with a recovery code.
  //
  // generateLink emits the actual error in the `error` field on failure.
  // We surface it verbatim — usually it's a Site URL / Redirect URL
  // allowlist mismatch ("redirect_to is not allowed") or an SMTP/email
  // provider misconfiguration.
  try {
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: targetEmail,
      options: {
        redirectTo: `${allowOrigin}/reset-password`
      }
    })
    if (linkErr) {
      console.error('reset-password: generateLink failed', { msg: linkErr.message, status: linkErr.status, name: linkErr.name })
      return jsonError(500, `generateLink: ${linkErr.message}`)
    }
    console.log('reset-password: generated link for', targetEmail, 'action_link present:', !!linkData?.properties?.action_link)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('reset-password: generateLink threw', msg)
    return jsonError(500, `generateLink threw: ${msg}`)
  }

  const response: ResetResponse = { ok: true, email: targetEmail }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
})
