// supabase/functions/promote-family-member/index.ts
//
// Promote a placeholder family_member into a real auth-backed
// household_members row. Used when a kid in the family is old enough
// (or just needs) their own login.
//
// Flow:
//   1. Verify caller is household owner.
//   2. Read the family_members row inside the caller's RLS view; bail if
//      the placeholder doesn't exist or belongs to another household.
//   3. Service-role: generate a 16-char random password, create the
//      auth user with email_confirm:true (same shape as add-household-member).
//   4. INSERT household_members with the family_member's name as
//      display_name; role defaults to 'member'.
//   5. DELETE the family_members row so we don't carry both identities.
//   6. Return the new user_id + initial password (shown to admin once).
//   7. If the household_members insert fails, roll back the auth user
//      AND restore the family_members row.

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface PromoteRequest {
  household_id: string
  family_member_id: string
  email: string
  display_name?: string  // optional override; defaults to family_members.name
  role?: 'owner' | 'member'  // defaults to 'member'
}

interface PromoteResponse {
  user_id: string
  email: string
  initial_password: string
  display_name: string
  role: 'owner' | 'member'
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
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Vary': 'Origin'
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

  let body: Partial<PromoteRequest>
  try {
    body = (await req.json()) as Partial<PromoteRequest>
  } catch {
    return jsonError(400, 'invalid json body')
  }
  if (!body.household_id || !body.family_member_id || !body.email) {
    return jsonError(400, 'missing required field')
  }
  if (!isLikelyEmail(body.email)) return jsonError(400, 'invalid email')
  const role: 'owner' | 'member' = body.role === 'owner' ? 'owner' : 'member'

  const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${callerJwt}` } }
  })

  // Caller must be an owner of this household.
  const { data: callerMembership, error: callerErr } = await callerClient
    .from('household_members')
    .select('role')
    .eq('household_id', body.household_id)
    .maybeSingle()
  if (callerErr) return jsonError(500, callerErr.message)
  if (!callerMembership || callerMembership.role !== 'owner') {
    return jsonError(403, 'only owners can promote family members')
  }

  // The placeholder must exist in the caller's household.
  const { data: placeholder, error: placeholderErr } = await callerClient
    .from('family_members')
    .select('id, name, relationship')
    .eq('household_id', body.household_id)
    .eq('id', body.family_member_id)
    .maybeSingle()
  if (placeholderErr) return jsonError(500, placeholderErr.message)
  if (!placeholder) return jsonError(404, 'family member not found in this household')

  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const initialPassword = generatePassword()
  const finalDisplayName = (body.display_name?.trim() || placeholder.name || '').trim()
  if (!finalDisplayName) return jsonError(400, 'display name resolves to empty')

  // Create the auth user.
  const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: initialPassword,
    email_confirm: true
  })
  if (createErr || !created.user) {
    return jsonError(400, createErr?.message ?? 'failed to create user')
  }

  // Insert household_members.
  const { error: insertErr } = await adminClient
    .from('household_members')
    .insert({
      household_id: body.household_id,
      user_id: created.user.id,
      role,
      display_name: finalDisplayName,
      is_active: true
    })
  if (insertErr) {
    await adminClient.auth.admin.deleteUser(created.user.id)
    return jsonError(500, insertErr.message)
  }

  // Delete the placeholder. Failure here is recoverable but logged via the
  // surfaced error message — both rows exist in that case (admin can clean
  // up by deleting the family_members row manually).
  const { error: delErr } = await adminClient
    .from('family_members')
    .delete()
    .eq('household_id', body.household_id)
    .eq('id', body.family_member_id)
  if (delErr) {
    return jsonError(500, `promotion partially succeeded; placeholder cleanup failed: ${delErr.message}`)
  }

  const response: PromoteResponse = {
    user_id: created.user.id,
    email: body.email,
    initial_password: initialPassword,
    display_name: finalDisplayName,
    role
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
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => charset[b % charset.length]).join('')
}
