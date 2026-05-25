/**
 * Playwright globalTeardown — deletes the test user provisioned by
 * `global-setup.ts`. Runs only when `E2E_AUTH_AVAILABLE === '1'`.
 *
 * Deletion order:
 *   1. household_members row (no ON DELETE CASCADE from auth.users — explicit).
 *   2. auth.mfa_factors rows (cascade-deleted with auth.users; explicit for clarity).
 *   3. auth.users row via `auth.admin.deleteUser`.
 *
 * All errors are swallowed-with-log so a single teardown failure doesn't
 * mask a real test failure.
 */

import type { FullConfig } from '@playwright/test'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  if (process.env.E2E_AUTH_AVAILABLE !== '1') return

  const userId = process.env.E2E_USER_ID
  if (!userId) {
    console.warn('[e2e] teardown: E2E_USER_ID not set — nothing to delete.')
    return
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.warn('[e2e] teardown: Supabase credentials missing — cannot clean up.')
    return
  }

  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Remove household membership.
  const { error: membershipErr } = await admin
    .from('household_members')
    .delete()
    .eq('user_id', userId)
  if (membershipErr) {
    console.warn(`[e2e] teardown: failed to delete household_members row: ${membershipErr.message}`)
  }

  // 2. Delete the user (auth.mfa_factors cascade-delete via FK on auth.users).
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId)
  if (deleteUserErr) {
    console.warn(`[e2e] teardown: failed to delete user ${userId}: ${deleteUserErr.message}`)
    return
  }

  console.log(`[e2e] Cleaned up test user ${userId}`)
}
