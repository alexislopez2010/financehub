/**
 * Playwright globalSetup — provisions an authenticated test user and saves
 * its session cookies to `tests/.auth/user.json` so the `authenticated`
 * project can run pre-authenticated specs.
 *
 * Graceful degradation: if `SUPABASE_SERVICE_ROLE_KEY` is not set, this
 * setup skips and the `authenticated` project's tests will mark themselves
 * `test.skip()` via the shared `E2E_AUTH_AVAILABLE` env flag.
 *
 * The provisioning flow:
 *   1. Create a unique test user via `auth.admin.createUser({ email_confirm: true })`.
 *   2. Link the user to the Lopez household as a `member`.
 *   3. Call the test-only RPC `dev_grant_aal2` to attach a synthetic verified
 *      TOTP factor (uses well-known secret `JBSWY3DPEHPK3PXP`).
 *   4. Drive a browser to /login, fill the email + password, submit.
 *   5. If the app redirects to /mfa/challenge, compute the TOTP code from
 *      the well-known secret and submit it.
 *   6. Save the resulting storageState.
 *
 * The user id and email are stashed in `process.env` for teardown.
 */

import { chromium, type FullConfig } from '@playwright/test'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createHmac } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

/**
 * Generate an RFC 6238 TOTP code from a base32-encoded secret.
 * Defaults: 30s period, 6 digits, SHA-1 — matches Supabase TOTP enrollment.
 *
 * Hand-rolled instead of pulling in a dep — only used by E2E setup.
 */
function generateTotp(base32Secret: string, time: number = Date.now()): string {
  const key = base32Decode(base32Secret)
  const counter = Math.floor(time / 1000 / 30)
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeUInt32BE(Math.floor(counter / 0x1_0000_0000), 0)
  counterBuf.writeUInt32BE(counter & 0xffff_ffff, 4)
  const hmac = createHmac('sha1', key).update(counterBuf).digest()
  // Dynamic truncation per RFC 4226 §5.3. Buffer indices are always defined
  // for SHA-1 (20 bytes), but TS strict requires explicit narrowing.
  const lastByte = hmac.at(-1) ?? 0
  const offset = lastByte & 0x0f
  const b0 = hmac.at(offset) ?? 0
  const b1 = hmac.at(offset + 1) ?? 0
  const b2 = hmac.at(offset + 2) ?? 0
  const b3 = hmac.at(offset + 3) ?? 0
  const binCode = ((b0 & 0x7f) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff)
  const code = binCode % 1_000_000
  return code.toString().padStart(6, '0')
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch)
    if (idx === -1) throw new Error(`Invalid base32 character: ${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/**
 * Tiny .env loader — avoids pulling in the `dotenv` dep just for E2E setup.
 * Parses KEY=VALUE lines; supports quoted values; ignores blanks + comments.
 * Sets `process.env[KEY]` only if not already defined (existing env wins).
 */
async function loadEnvFile(path: string): Promise<void> {
  let contents: string
  try {
    contents = await readFile(path, 'utf8')
  } catch {
    return
  }
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const TEST_TOTP_SECRET = 'JBSWY3DPEHPK3PXP'
const LOPEZ_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001'
const STORAGE_STATE_PATH = resolve(__dirname, '.auth/user.json')

interface SetupOk {
  status: 'ok'
  userId: string
  email: string
}

interface SetupSkipped {
  status: 'skipped'
  reason: string
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // Load `.env.test` if present (gitignored) so the user can keep the service
  // role key out of the shell environment. Also load `.env.local` for the
  // public Supabase URL fallback.
  await loadEnvFile(resolve(__dirname, '../.env.test'))
  await loadEnvFile(resolve(__dirname, '../.env.local'))

  const result = await provisionTestUser()
  if (result.status === 'skipped') {
    console.log(`[e2e] ${result.reason}`)
    console.log('[e2e] To enable authenticated E2E:')
    console.log('[e2e]   1. Get the service role key from Supabase Dashboard → Project Settings → API')
    console.log('[e2e]   2. Add to apps/web/.env.test:')
    console.log('[e2e]        SUPABASE_SERVICE_ROLE_KEY=<key>')
    console.log('[e2e]        NEXT_PUBLIC_SUPABASE_URL=<url> (optional; falls back to .env.local)')
    console.log('[e2e]   3. .env.test is gitignored — never commit the service role key.')
    process.env.E2E_AUTH_AVAILABLE = '0'
    return
  }

  process.env.E2E_AUTH_AVAILABLE = '1'
  process.env.E2E_USER_ID = result.userId
  process.env.E2E_USER_EMAIL = result.email
  console.log(`[e2e] Provisioned test user ${result.email} (${result.userId})`)
}

async function provisionTestUser(): Promise<SetupOk | SetupSkipped> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceKey) {
    return {
      status: 'skipped',
      reason: 'SUPABASE_SERVICE_ROLE_KEY not set — authenticated tests will skip.'
    }
  }
  if (!url) {
    return {
      status: 'skipped',
      reason: 'NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL not set — authenticated tests will skip.'
    }
  }

  const admin = createAdminClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Create a unique test user.
  const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const email = `e2e+${nonce}@test.financehub.local`
  const password = `e2e-${nonce}-${Math.random().toString(36).slice(2, 12)}`
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (createErr || !created.user) {
    throw new Error(`[e2e] Failed to create test user: ${createErr?.message ?? 'unknown error'}`)
  }
  const userId = created.user.id

  /** Best-effort cleanup helper: swallows errors so the main error surfaces. */
  async function safeCleanup(): Promise<void> {
    try { await admin.from('household_members').delete().eq('user_id', userId) } catch { /* ignore */ }
    try { await admin.auth.admin.deleteUser(userId) } catch { /* ignore */ }
  }

  // 2. Link the user to the Lopez household as a member.
  //    The `handle_new_user` trigger may have already inserted a row if this email
  //    happens to be allowlisted — guard with onConflict to make this idempotent.
  const { error: linkErr } = await admin
    .from('household_members')
    .upsert(
      {
        user_id: userId,
        household_id: LOPEZ_HOUSEHOLD_ID,
        role: 'member',
        display_name: 'E2E Test User'
      },
      { onConflict: 'user_id,household_id' }
    )
  if (linkErr) {
    await safeCleanup()
    throw new Error(`[e2e] Failed to link user to household: ${linkErr.message}`)
  }

  // 3. Grant AAL2 via the test-only RPC. Service-role caller — the
  //    `auth.role() = 'service_role'` branch in dev_grant_aal2 allows this.
  const { error: rpcErr } = await admin.rpc('dev_grant_aal2', { target_user: userId })
  if (rpcErr) {
    await safeCleanup()
    throw new Error(`[e2e] Failed to grant AAL2 to test user: ${rpcErr.message}`)
  }

  // 4. Drive a browser to /login, fill the form, handle the MFA challenge.
  await mkdir(dirname(STORAGE_STATE_PATH), { recursive: true })
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100'
  const browser = await chromium.launch()
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto(`${baseURL}/login`)
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // After login the app either lands on / (rare, no MFA) or /mfa/challenge.
    // The MFA challenge form asks for a 6-digit code derived from the user's
    // verified TOTP secret. We compute it from the well-known test secret.
    await page.waitForURL(/\/(mfa\/challenge|$)/, { timeout: 15_000 })

    if (page.url().includes('/mfa/challenge')) {
      const code = generateTotp(TEST_TOTP_SECRET)
      // The challenge input is typically labeled "Code" or "Verification code".
      const codeInput = page
        .getByLabel(/code/i)
        .or(page.getByRole('textbox', { name: /code/i }))
        .first()
      await codeInput.fill(code)
      await page.getByRole('button', { name: /(verify|submit|continue|sign in)/i }).first().click()
      // Wait for redirect away from the challenge page.
      await page.waitForURL((u) => !u.toString().includes('/mfa/challenge'), { timeout: 15_000 })
    }

    // Sanity: confirm we landed on an authenticated surface.
    await page.waitForLoadState('domcontentloaded')
    await ctx.storageState({ path: STORAGE_STATE_PATH })
  } finally {
    await ctx.close()
    await browser.close()
  }

  return { status: 'ok', userId, email }
}
