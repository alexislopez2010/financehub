'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code')
})
type FormData = z.infer<typeof schema>

export function MfaChallengeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') ?? '/'

  const [factorId, setFactorId] = useState<string | null>(null)
  const [factorError, setFactorError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' }
  })

  useEffect(() => {
    let cancelled = false
    async function loadFactor() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (cancelled) return
        if (error || !data) {
          setFactorError(error?.message ?? 'Could not load MFA factors')
          return
        }
        const verified = (data.totp ?? []).find(f => f.status === 'verified')
        if (!verified) {
          setFactorError('No verified MFA factor found. Contact a household owner.')
          return
        }
        setFactorId(verified.id)
      } catch (e: unknown) {
        if (!cancelled) {
          setFactorError(e instanceof Error ? e.message : 'Could not load MFA factors')
        }
      }
    }
    void loadFactor()
    return () => { cancelled = true }
  }, [])

  async function onVerify(values: FormData) {
    if (!factorId) return
    setVerifyError(null)
    setIsVerifying(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: values.code
      })
      if (error) {
        // Some Supabase MFA errors come back with empty/missing message.
        // Always surface SOMETHING actionable so the user isn't stuck.
        const fallback =
          'status' in error && typeof (error as { status?: number }).status === 'number' &&
          (error as { status: number }).status === 422
            ? 'Invalid or expired code. Try a fresh code from your authenticator (watch the 30-second timer).'
            : 'Verification failed. Try a fresh code from your authenticator.'
        setVerifyError(error.message?.trim() || fallback)
        return
      }
      // Force the local JS session to pick up the new AAL2 access token
      // (challengeAndVerify upgrades the session server-side, but the
      // browser client's cached JWT may still claim AAL1 until refreshed).
      // Without this + a hard navigation, middleware on the next request
      // sometimes sees the stale AAL1 JWT and bounces back to /mfa/challenge,
      // making the form appear to "do nothing" until the user reloads.
      await supabase.auth.refreshSession()
      // Hard navigation forces the browser to re-read auth cookies fresh,
      // avoiding the Next.js client-router cookie-propagation race.
      window.location.assign(next)
    } catch (e: unknown) {
      setVerifyError(
        e instanceof Error && e.message.trim().length > 0
          ? e.message
          : 'Verification failed. Try a fresh code from your authenticator.'
      )
    } finally {
      setIsVerifying(false)
    }
  }

  if (factorError) {
    return (
      <div role="alert" className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
        {factorError}
      </div>
    )
  }

  if (!factorId) {
    return <p className="text-sm text-muted italic">Loading…</p>
  }

  return (
    <form onSubmit={handleSubmit(onVerify)} className="space-y-6" noValidate>
      {verifyError && (
        <div role="alert" className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn">
          {verifyError}
        </div>
      )}

      <div>
        <label htmlFor="code" className="block text-xs font-medium uppercase tracking-wider text-muted mb-1">
          6-digit code
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          {...register('code')}
          className={cn(
            'w-full rounded-lg border bg-bg px-3 py-2 text-sm tabular tracking-[0.2em] text-center text-ink',
            'focus:outline-none focus:ring-2 focus:ring-ink/10',
            errors.code ? 'border-warn' : 'border-rule'
          )}
        />
        {errors.code && <p className="mt-1 text-xs text-warn">{errors.code.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isVerifying}
        className={cn(
          'w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-bg',
          'transition hover:bg-ink/90 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {isVerifying ? 'Verifying…' : 'Verify'}
      </button>
    </form>
  )
}
