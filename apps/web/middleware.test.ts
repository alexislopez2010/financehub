import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// Mocks must come BEFORE the SUT import.
const mockUpdateSession = vi.fn()
vi.mock('@/lib/supabase/middleware', () => ({
  updateSession: (...args: unknown[]) => mockUpdateSession(...args)
}))

const mockMustChallenge = vi.fn()
const mockHasVerifiedTotp = vi.fn()
vi.mock('@/lib/auth/aal', () => ({
  mustChallenge: (...args: unknown[]) => mockMustChallenge(...args),
  hasVerifiedTotp: (...args: unknown[]) => mockHasVerifiedTotp(...args)
}))

import { middleware } from './middleware'

const FAKE_USER = { id: 'u1', email: 'a@b.c' }

function makeReq(path: string, search = ''): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}${search}`))
}

function passthrough(): NextResponse {
  return NextResponse.next()
}

beforeEach(() => {
  mockUpdateSession.mockReset()
  mockMustChallenge.mockReset()
  mockHasVerifiedTotp.mockReset()
})

describe('middleware', () => {
  it('passes /login through when no user is present', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: null })
    const res = await middleware(makeReq('/login'))
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects authed AAL2 user away from /login to /', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: FAKE_USER })
    mockMustChallenge.mockResolvedValueOnce(false)
    const res = await middleware(makeReq('/login'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/')
  })

  it('keeps authed AAL1 user on /login (they still need to challenge)', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: FAKE_USER })
    mockMustChallenge.mockResolvedValueOnce(true)
    const res = await middleware(makeReq('/login'))
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects unauth user from protected / to /login?next=/', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: null })
    const res = await middleware(makeReq('/'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2F')
  })

  it('redirects unauth user from protected /ledger to /login?next=/ledger', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: null })
    const res = await middleware(makeReq('/ledger'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fledger')
  })

  it('lets authed AAL2 user through to /', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: FAKE_USER })
    mockMustChallenge.mockResolvedValueOnce(false)
    const res = await middleware(makeReq('/'))
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects authed AAL1 user with TOTP enrolled to /mfa/challenge', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: FAKE_USER })
    mockMustChallenge.mockResolvedValueOnce(true)
    mockHasVerifiedTotp.mockResolvedValueOnce(true)
    const res = await middleware(makeReq('/ledger'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/mfa/challenge?next=%2Fledger')
  })

  it('redirects authed AAL1 user with NO TOTP enrolled to /mfa/enroll', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: FAKE_USER })
    mockMustChallenge.mockResolvedValueOnce(true)
    mockHasVerifiedTotp.mockResolvedValueOnce(false)
    const res = await middleware(makeReq('/ledger'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost/mfa/enroll?next=%2Fledger')
  })

  it('passes /mfa/challenge through for authenticated users', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: FAKE_USER })
    const res = await middleware(makeReq('/mfa/challenge'))
    expect(res.status).toBeLessThan(400)
    expect(res.headers.get('location')).toBeNull()
  })

  it('redirects unauth user from /mfa/challenge to /login', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: null })
    const res = await middleware(makeReq('/mfa/challenge'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login?next=%2Fmfa%2Fchallenge')
  })

  it('preserves query string in next= when redirecting unauth user', async () => {
    mockUpdateSession.mockResolvedValueOnce({ supabaseResponse: passthrough(), supabase: {}, user: null })
    const res = await middleware(makeReq('/ledger', '?account=chase'))
    expect(res.headers.get('location')).toBe('http://localhost/login?next=%2Fledger%3Faccount%3Dchase')
  })
})
