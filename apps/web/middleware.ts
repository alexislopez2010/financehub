import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { mustChallenge, hasVerifiedTotp } from '@/lib/auth/aal'

// Routes that don't require authentication at all.
const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password'
  // NOTE: /design-system is intentionally NOT public — it's an internal
  // component showcase. It now requires an authenticated AAL2 session like
  // any other app route.
])

// Routes that require a session but do NOT require AAL2 (these are how users get to AAL2).
const AUTH_PASSTHROUGH_PATHS = new Set<string>([
  '/mfa/enroll',
  '/mfa/challenge',
  '/auth/callback'
])

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true
  // Static assets and Next.js internals are excluded by the matcher; this is belt-and-suspenders.
  return pathname.startsWith('/_next/') || pathname === '/favicon.ico'
}

function isAuthPassthrough(pathname: string): boolean {
  return AUTH_PASSTHROUGH_PATHS.has(pathname)
}

function redirectTo(request: NextRequest, path: string, withNext = false): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = path
  url.search = ''
  if (withNext) {
    url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  }
  return NextResponse.redirect(url)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always refresh the session first — required by Supabase SSR docs.
  const { supabaseResponse, supabase, user } = await updateSession(request)

  // Public routes: pass through, but kick out fully-authed users from /login etc.
  if (isPublic(pathname)) {
    if (user && (pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password')) {
      const isChallengeRequired = await mustChallenge(supabase)
      if (!isChallengeRequired) {
        return redirectTo(request, '/')
      }
    }
    return supabaseResponse
  }

  // MFA + recovery flow routes: require a session but no AAL2 yet.
  if (isAuthPassthrough(pathname)) {
    if (!user) {
      return redirectTo(request, '/login', true)
    }
    return supabaseResponse
  }

  // All other routes are protected (the (app) group).
  if (!user) {
    return redirectTo(request, '/login', true)
  }

  // Authed but maybe not at AAL2. Decide between enroll vs challenge.
  const isChallengeRequired = await mustChallenge(supabase)
  if (!isChallengeRequired) {
    return supabaseResponse  // happy path
  }

  // mustChallenge === true. If they have a verified factor, challenge it.
  // If they don't, force enrollment.
  const hasFactor = await hasVerifiedTotp(supabase)
  return redirectTo(request, hasFactor ? '/mfa/challenge' : '/mfa/enroll', true)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - public asset extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
  ]
}
