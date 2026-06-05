// supabase/functions/set-household-member-active/index.ts
//
// Toggle a household member's enabled state without deleting their data.
//
// Two-layer enforcement:
//   1. household_members.is_active = active  (application-visible flag)
//   2. auth.users banned via ban_duration / unbanned via 'none'
//      (so the auth layer actually rejects sign-ins for disabled members)
//
// Owners cannot disable themselves — saves them from locking themselves
// out of the household.

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface SetActiveRequest {
  household_id: string
  target_user_id: string
  active: boolean
}

interface SetActiveResponse {
  ok: true
  user_id: string
  active: boolean
}

// Ban duration string accepted by Supabase admin API. ~876,000 hours = 100y;
// effectively permanent until the admin unbans by passing 'none'.
const FOREVER_BAN = '876000h'

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

  let body: Partial<SetActiveRequest>
  try {
    body = (await req.json()) as Partial<SetActiveRequest>
  } catch {
    return jsonError(400, 'invalid json body')
  }
  if (!body.household_id || !body.target_user_id || typeof body.active !== 'boolean') {
    return jsonError(400, 'missing required field')
  }

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } }
  })

  // Identify the caller — used both for the owner check and the
  // self-disable guard below.
  const { data: { user: caller }, error: callerAuthErr } = await callerClient.auth.getUser()
  if (callerAuthErr || !caller) return jsonError(401, 'invalid session')

  // Scope to the caller's own row — without .eq('user_id', caller.id) this
  // returns multiple rows in any household with >1 owner and .maybeSingle()
  // raises PGRST116 ("multiple (or no) rows returned").
  const { data: callerMembership, error: callerErr } = await callerClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.household_id)
    .eq('user_id', caller.id)
    .maybeSingle()
  if (callerErr) return jsonError(500, `callerCheck: ${callerErr.message}`)
  if (!callerMembership || callerMembership.role !== 'owner') {
    return jsonError(403, 'only owners can change member active state')
  }

  // Owners can disable other members but never themselves — protects against
  // locking the household out by accident.
  if (!body.active && caller.id === body.target_user_id) {
    return jsonError(400, 'owners cannot disable their own account')
  }

  // Target must be a member of the same household.
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

  // 1) Application flag.
  const { error: updErr } = await adminClient
    .from('household_members')
    .update({ is_active: body.active })
    .eq('household_id', body.household_id)
    .eq('user_id', body.target_user_id)
  if (updErr) return jsonError(500, updErr.message)

  // 2) Auth-layer ban. `ban_duration: 'none'` clears any active ban; the
  //    long duration is treated as permanent until cleared.
  const { error: banErr } = await adminClient.auth.admin.updateUserById(
    body.target_user_id,
    { ban_duration: body.active ? 'none' : FOREVER_BAN } as { ban_duration: string }
  )
  if (banErr) {
    // Roll back the flag so the two layers don't disagree on truth.
    await adminClient
      .from('household_members')
      .update({ is_active: !body.active })
      .eq('household_id', body.household_id)
      .eq('user_id', body.target_user_id)
    return jsonError(500, `auth ban update failed: ${banErr.message}`)
  }

  const response: SetActiveResponse = {
    ok: true,
    user_id: body.target_user_id,
    active: body.active
  }
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
})
