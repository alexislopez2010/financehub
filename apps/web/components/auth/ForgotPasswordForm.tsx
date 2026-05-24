'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'

const schema = z.object({
  email: z.string().email('Enter a valid email')
})
type FormData = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' }
  })

  async function onSubmit(values: FormData) {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
      })
      if (error) {
        setSubmitError(error.message)
        return
      }
      setSent(true)
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Could not send reset email')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-rule bg-surface px-4 py-3 text-sm text-ink">
        Check your inbox for a reset link. (If you don&apos;t see it, check spam.)
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {submitError && (
        <div role="alert" className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn">
          {submitError}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wider text-muted mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          {...register('email')}
          className={cn(
            'w-full rounded-lg border bg-bg px-3 py-2 text-sm text-ink',
            'focus:outline-none focus:ring-2 focus:ring-ink/10',
            errors.email ? 'border-warn' : 'border-rule'
          )}
        />
        {errors.email && <p className="mt-1 text-xs text-warn">{errors.email.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-bg',
          'transition hover:bg-ink/90 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {isSubmitting ? 'Sending…' : 'Send reset email'}
      </button>
    </form>
  )
}
