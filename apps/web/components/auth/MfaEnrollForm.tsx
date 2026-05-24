'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code')
})
type VerifyData = z.infer<typeof verifySchema>

interface EnrollData {
  factorId: string
  qrSvg: string
  secret: string
}

export function MfaEnrollForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') ?? '/'

  const [enrollment, setEnrollment] = useState<EnrollData | null>(null)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<VerifyData>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: '' }
  })

  useEffect(() => {
    let cancelled = false
    async function enroll() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
        if (cancelled) return
        if (error || !data) {
          setEnrollError(error?.message ?? 'Could not start MFA enrollment')
          return
        }
        setEnrollment({
          factorId: data.id,
          qrSvg: data.totp.qr_code,
          secret: data.totp.secret
        })
      } catch (e: unknown) {
        if (!cancelled) {
          setEnrollError(e instanceof Error ? e.message : 'Could not start MFA enrollment')
        }
      }
    }
    void enroll()
    return () => { cancelled = true }
  }, [])

  async function onVerify(values: VerifyData) {
    if (!enrollment) return
    setVerifyError(null)
    setIsVerifying(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.factorId,
        code: values.code
      })
      if (error) {
        setVerifyError(error.message)
        return
      }
      router.refresh()
      router.replace(next)
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  if (enrollError) {
    return (
      <div role="alert" className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn">
        {enrollError}
      </div>
    )
  }

  if (!enrollment) {
    return <p className="text-sm text-muted italic">Generating your authenticator code…</p>
  }

  return (
    <form onSubmit={handleSubmit(onVerify)} className="space-y-6" noValidate>
      <div className="space-y-3">
        <p className="text-sm text-ink">
          Scan this code with your authenticator app (Authy, Google Authenticator, 1Password).
        </p>
        <div
          className="mx-auto w-48 h-48 rounded-lg border border-rule bg-bg p-3 [&_svg]:w-full [&_svg]:h-full"
          aria-label="MFA QR code"
          dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
        />
        <details className="text-xs">
          <summary className="cursor-pointer text-muted italic">Can&apos;t scan? Enter the secret manually</summary>
          <code className="mt-2 block break-all rounded bg-surface px-3 py-2 text-xs tabular">
            {enrollment.secret}
          </code>
        </details>
      </div>

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
        {isVerifying ? 'Verifying…' : 'Verify and continue'}
      </button>
    </form>
  )
}
