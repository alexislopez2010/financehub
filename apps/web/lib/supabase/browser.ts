import { createBrowserClient } from '@supabase/ssr'

/**
 * Returns a Supabase browser client.
 *
 * IMPORTANT: env vars are accessed as literal `process.env.NEXT_PUBLIC_*`
 * properties (not via a helper with a dynamic key). Next.js's compile-time
 * replacement only works on literal accesses — `process.env[name]` through
 * a variable becomes a runtime lookup against an empty object in the browser
 * bundle and silently returns undefined.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_URL')
  if (!key) throw new Error('Missing required env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return createBrowserClient(url, key)
}
