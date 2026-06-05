'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { X, Copy, Check, RefreshCw } from 'lucide-react'
import type { HouseholdMemberRow } from '@/lib/data/admin'
import { useSetHouseholdMemberPassword } from '@/lib/data/admin'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { cn } from '@/lib/cn'

export interface SetPasswordDialogProps {
  /** When non-null, the dialog opens for this member. */
  member: HouseholdMemberRow | null
  onClose: () => void
}

// Charset matches the random-password generator in add-household-member: 16
// chars, ambiguous characters (0/O, 1/l/I) excluded, includes punctuation.
const PASSWORD_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
const GENERATED_LENGTH = 16
const MIN_LENGTH = 8

function generatePassword(): string {
  const bytes = new Uint8Array(GENERATED_LENGTH)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => PASSWORD_CHARSET[b % PASSWORD_CHARSET.length]).join('')
}

/**
 * Admin dialog for setting a temporary password on a household member.
 * Sets `must_reset_password = true` on the target, so the user is forced
 * to /reset-password on their next page navigation until they pick a fresh
 * password.
 *
 * UX notes:
 *   - Generates a random initial password but lets the admin overwrite it
 *     so they can read out a memorable phrase out-of-band if they prefer.
 *   - Shows a copy-to-clipboard affordance — the temporary password is the
 *     only thing the admin needs to communicate to the user.
 *   - After success, displays a confirmation that the user will be forced
 *     to change it on next login.
 */
export function SetPasswordDialog({ member, onClose }: SetPasswordDialogProps) {
  const open = member !== null
  const setPassword = useSetHouseholdMemberPassword()
  const [password, setPassword_] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset transient state on each open and seed a fresh random password
  // so the admin doesn't have to think of one to get started.
  useEffect(() => {
    if (member) {
      setPassword_(generatePassword())
      setSubmitError(null)
      setSuccess(null)
      setCopied(false)
    }
  }, [member])

  async function handleConfirm() {
    if (!member) return
    setSubmitError(null)
    try {
      await setPassword.mutateAsync({
        household_id: LOPEZ_HOUSEHOLD_ID,
        target_user_id: member.user_id,
        password
      })
      setSuccess({ password })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to set password')
    }
  }

  async function copyToClipboard() {
    const value = success?.password ?? password
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // navigator.clipboard can fail in non-secure contexts; let the user
      // select the text manually. We don't surface this as an error.
    }
  }

  const displayName = member?.display_name?.trim() || member?.email || ''
  const tooShort = password.length > 0 && password.length < MIN_LENGTH

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[92vw] max-w-md',
          'rounded-2xl bg-surface shadow-2xl'
        )}>
          <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-ink">
              Set temporary password
            </Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {success === null ? (
              <>
                <p className="text-sm text-ink">
                  Set a temporary password for <span className="font-medium">{displayName}</span>.
                  They will be forced to change it on their next page navigation.
                </p>

                <div>
                  <label htmlFor="set-password-input" className="block text-xs font-medium uppercase tracking-wider text-muted mb-1">
                    Temporary password
                  </label>
                  <div className="flex items-stretch gap-2">
                    <input
                      id="set-password-input"
                      type="text"
                      value={password}
                      onChange={e => setPassword_(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                      aria-invalid={tooShort || undefined}
                      className={cn(
                        'flex-1 rounded-lg border bg-bg px-3 py-2 text-sm text-ink tabular focus:outline-none focus:ring-2 focus:ring-ink/10',
                        tooShort ? 'border-red-400' : 'border-rule'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setPassword_(generatePassword())}
                      title="Generate a new random password"
                      aria-label="Generate new password"
                      className="px-2.5 rounded-lg border border-rule text-muted hover:text-ink hover:bg-bg"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      title="Copy password"
                      aria-label="Copy password"
                      className="px-2.5 rounded-lg border border-rule text-muted hover:text-ink hover:bg-bg"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className={cn('mt-1 text-[11px]', tooShort ? 'text-red-600' : 'text-muted')}>
                    {tooShort
                      ? `Password must be at least ${MIN_LENGTH} characters.`
                      : 'Share this password with the user out-of-band — they will reset it on first login.'}
                  </p>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={setPassword.isPending || password.length < MIN_LENGTH}
                    className={cn(
                      'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
                      'hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    {setPassword.isPending ? 'Setting…' : 'Set password'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Password set for <span className="font-medium">{displayName}</span>.
                  They will be forced to change it on next page navigation.
                </p>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wider text-muted mb-1">
                    Temporary password (share with the user)
                  </label>
                  <div className="flex items-stretch gap-2">
                    <input
                      readOnly
                      value={success.password}
                      onFocus={e => e.currentTarget.select()}
                      className="flex-1 rounded-lg border border-rule bg-bg px-3 py-2 text-sm text-ink tabular focus:outline-none focus:ring-2 focus:ring-ink/10"
                    />
                    <button
                      type="button"
                      onClick={copyToClipboard}
                      title="Copy password"
                      aria-label="Copy password"
                      className="px-2.5 rounded-lg border border-rule text-muted hover:text-ink hover:bg-bg"
                    >
                      {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted">
                    This password will not be shown again after you close this dialog.
                  </p>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg bg-ink text-bg text-sm font-medium hover:bg-ink/90"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
