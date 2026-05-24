import { describe, it, expect, vi } from 'vitest'
import { mustChallenge, hasVerifiedTotp } from './aal'
import type { SupabaseClient } from '@supabase/supabase-js'

function makeClient(getAalImpl: () => Promise<unknown>, listFactorsImpl?: () => Promise<unknown>): SupabaseClient {
  return {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(getAalImpl),
        listFactors: vi.fn(listFactorsImpl ?? (async () => ({ data: { totp: [] }, error: null })))
      }
    }
  } as unknown as SupabaseClient
}

describe('mustChallenge', () => {
  it('returns false when current level is aal2', async () => {
    const sb = makeClient(async () => ({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null }))
    expect(await mustChallenge(sb)).toBe(false)
  })

  it('returns false when no MFA factor is enrolled (nextLevel !== aal2)', async () => {
    const sb = makeClient(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }))
    expect(await mustChallenge(sb)).toBe(false)
  })

  it('returns true when at aal1 with aal2 available', async () => {
    const sb = makeClient(async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }))
    expect(await mustChallenge(sb)).toBe(true)
  })

  it('returns true when data is null (fail closed)', async () => {
    const sb = makeClient(async () => ({ data: null, error: null }))
    expect(await mustChallenge(sb)).toBe(true)
  })

  it('returns true when an error is returned (fail closed)', async () => {
    const sb = makeClient(async () => ({ data: null, error: new Error('boom') }))
    expect(await mustChallenge(sb)).toBe(true)
  })

  it('returns true when the call throws (fail closed)', async () => {
    const sb = makeClient(async () => { throw new Error('boom') })
    expect(await mustChallenge(sb)).toBe(true)
  })
})

describe('hasVerifiedTotp', () => {
  it('returns true when totp array contains a verified factor', async () => {
    const sb = makeClient(
      async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }),
      async () => ({ data: { totp: [{ status: 'verified', id: 'x' }] }, error: null })
    )
    expect(await hasVerifiedTotp(sb)).toBe(true)
  })

  it('returns false when totp is empty', async () => {
    const sb = makeClient(
      async () => ({ data: null, error: null }),
      async () => ({ data: { totp: [] }, error: null })
    )
    expect(await hasVerifiedTotp(sb)).toBe(false)
  })

  it('returns false when only unverified factors exist', async () => {
    const sb = makeClient(
      async () => ({ data: null, error: null }),
      async () => ({ data: { totp: [{ status: 'unverified', id: 'x' }] }, error: null })
    )
    expect(await hasVerifiedTotp(sb)).toBe(false)
  })

  it('returns false on error (fail closed in the "no MFA enrolled" direction)', async () => {
    const sb = makeClient(
      async () => ({ data: null, error: null }),
      async () => ({ data: null, error: new Error('boom') })
    )
    expect(await hasVerifiedTotp(sb)).toBe(false)
  })
})
