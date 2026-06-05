// supabase/functions/set-household-member-password/index.ts
//
// Admin-set password for a household member. Used when the recovery-email
// flow isn't workable (e.g., wrong address on file, deliverability issues)
// and the admin needs to assign a temporary password out-of-band.
//
// Side effects:
//   1. auth.users.encrypted_password rotated to a caller-supplied value.
//   2. household_members.must_reset_password = true on the target member,
//      forcing them to /reset-password on the next page navigation until
//      they pick their own password.
//
// Authorization model mirrors the other admin EFs:
//   - Bearer JWT identifies the caller.
//   - Caller must be an OWNER of the target household (scoped by user_id
//     to survive multi-owner households).
//   - Target must be a member of the same household.
//   - Caller cannot use this on themselves (admin should use the standard
//     /reset-password flow on their own account).

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface SetPasswordRequest {
  household_id: string
  target_user_id: string
  password: string
}

interface SetPasswordResponse {
  ok: true
  user_id: string
}

// Supabase's auth default min is 6; we require 8 for the admin path so
// admins don't hand out trivially-weak temporary passwords.
const MIN_PASSWORD_LEN = 8

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

  let body: Partial<SetPasswordRequest>
  try {
    body = (await req.json()) as Partial<SetPasswordRequest>
  } catch {
    return jsonError(400, 'invalid json body')
  }
  if (!body.household_id || !body.target_user_id || typeof body.password !== 'string') {
    return jsonError(400, 'missing required field')
  }
  if (body.password.length < MIN_PASSWORD_LEN) {
    return jsonError(400, `password must be at least ${MIN_PASSWORD_LEN} characters`)
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } }
  })

  const { data: callerAuth, error: callerAuthErr } = await callerClient.auth.getUser()
  if (callerAuthErr || !callerAuth.user) {
    return jsonError(401, `caller auth failed: ${callerAuthErr?.message ?? 'no user'}`)
  }
  const callerUserId = callerAuth.user.id

  // Self-target guard — admins should use the normal /reset-password flow
  // on their own account rather than this admin path. Saves them from
  // accidentally locking themselves into the force-reset loop.
  if (callerUserId === body.target_user_id) {
    return jsonError(400, 'cannot set your own password via the admin path; use the standard reset flow instead')
  }

  // Caller must be an owner of the target household.
  const { data: callerMembership, error: callerErr } = await callerClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.household_id)
    .eq('user_id', callerUserId)
    .maybeSingle()
  if (callerErr) return jsonError(500, `callerCheck: ${callerErr.message}`)
  if (!callerMembership || callerMembership.role !== 'owner') {
    return jsonError(403, 'only owners can set member passwords')
  }

  // Target must be a member of the same household. Verified via the
  // caller's RLS view so we never leak existence of arbitrary user ids.
  const { data: targetMembership, error: targetErr } = await callerClient
    .from('household_members')
    .select('user_id')
    .eq('household_id', body.household_id)
    .eq('user_id', body.target_user_id)
    .maybeSingle()
  if (targetErr) return jsonError(500, `targetCheck: ${targetErr.message}`)
  if (!targetMembership) return jsonError(404, 'target is not a member of this household')

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  // 1) Set the new password via the auth admin API.
  const { error: updateErr } = await adminClient.auth.admin.updateUserById(
    body.target_user_id,
    { password: body.password }
  )
  if (updateErr) {
    console.error('set-password: updateUserById failed', { msg: updateErr.message, status: updateErr.status })
    return jsonError(500, `updateUserById: ${updateErr.message}`)
  }

  // 2) Flag the member so the next page navigation forces /reset-password.
  //    Failure here is logged but not fatal — the password change already
  //    landed, and the admin can flip the flag manually if needed.
  const { error: flagErr } = await adminClient
    .from('household_members')
    .update({ must_reset_password: true })
    .eq('household_id', body.household_id)
    .eq('user_id', body.target_user_id)
  if (flagErr) {
    console.error('set-password: setting must_reset_password failed', { msg: flagErr.message })
    return jsonError(500, `flagSet: ${flagErr.message}`)
  }

  const response: SetPasswordResponse = { ok: true, user_id: body.target_user_id }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
})
