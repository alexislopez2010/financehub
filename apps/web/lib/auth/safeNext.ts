/**
 * Validates a post-auth `?next=` redirect target.
 *
 * Open-redirect guard: the value comes from a user-controlled query param and
 * is fed into router.replace / window.location.assign / NextResponse.redirect
 * after authentication. Without validation an attacker could craft
 * `/login?next=https://evil.com` (or `//evil.com`) so that a freshly
 * authenticated user is bounced to a phishing clone — a real risk for a
 * financial app.
 *
 * Only same-origin relative paths are allowed: must start with a single '/'
 * and not be protocol-relative ('//host') or backslash-escaped ('/\\host').
 * Anything else falls back to the default (home).
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (typeof raw !== 'string') return fallback
  const trimmed = raw.trim()
  if (trimmed.length === 0) return fallback
  // Must be a relative path on this origin.
  if (trimmed[0] !== '/') return fallback
  // Reject protocol-relative ('//evil.com') and backslash tricks ('/\\evil.com',
  // '/\/evil.com') that some browsers normalize to a host.
  if (trimmed[1] === '/' || trimmed[1] === '\\') return fallback
  return trimmed
}
