'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'

const schema = z
  .object({
    password: z.string().min(12, 'At least 12 characters'),
    confirm: z.string()
  })
  .refine(d => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm']
  })
type FormData = z.infer<typeof schema>

export function ResetPasswordForm() {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' }
  })

  async function onSubmit(values: FormData) {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password: values.password })
      if (error) {
        setSubmitError(error.message)
        return
      }
      router.refresh()
      router.replace('/')
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Could not update password')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {submitError && (
        <div role="alert" className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn">
          {submitError}
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wider text-muted mb-1">
          New password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          {...register('password')}
          className={cn(
            'w-full rounded-lg border bg-bg px-3 py-2 text-sm text-ink',
            'focus:outline-none focus:ring-2 focus:ring-ink/10',
            errors.password ? 'border-warn' : 'border-rule'
          )}
        />
        {errors.password && <p className="mt-1 text-xs text-warn">{errors.password.message}</p>}
      </div>

      <div>
        <label htmlFor="confirm" className="block text-xs font-medium uppercase tracking-wider text-muted mb-1">
          Confirm new password
        </label>
        <input
          id="confirm"
          type="password"
          autoComplete="new-password"
          {...register('confirm')}
          className={cn(
            'w-full rounded-lg border bg-bg px-3 py-2 text-sm text-ink',
            'focus:outline-none focus:ring-2 focus:ring-ink/10',
            errors.confirm ? 'border-warn' : 'border-rule'
          )}
        />
        {errors.confirm && <p className="mt-1 text-xs text-warn">{errors.confirm.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full rounded-lg bg-ink py-2.5 text-sm font-medium text-bg',
          'transition hover:bg-ink/90 disabled:opacity-60 disabled:cursor-not-allowed'
        )}
      >
        {isSubmitting ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}
