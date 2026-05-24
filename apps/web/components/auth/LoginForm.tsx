'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters')
})
type FormData = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') ?? '/'
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' }
  })

  async function onSubmit(values: FormData) {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword(values)
      if (error) {
        setSubmitError(error.message)
        return
      }
      // Force middleware to re-evaluate with the fresh session.
      router.refresh()
      router.replace(next)
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Sign-in failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {submitError && (
        <div
          role="alert"
          className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn"
        >
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
        {errors.email && (
          <p className="mt-1 text-xs text-warn">{errors.email.message}</p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-muted">
            Password
          </label>
          <a href="/forgot-password" className="text-xs italic text-muted hover:text-ink">
            Forgot?
          </a>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
          className={cn(
            'w-full rounded-lg border bg-bg px-3 py-2 text-sm text-ink',
            'focus:outline-none focus:ring-2 focus:ring-ink/10',
            errors.password ? 'border-warn' : 'border-rule'
          )}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-warn">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-bg',
          'transition hover:bg-ink/90 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
