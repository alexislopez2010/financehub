'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type FormEvent } from 'react'
import { X, CheckCircle, Copy, AlertTriangle } from 'lucide-react'
import type { HouseholdRole, AddHouseholdMemberResult } from '@/lib/data/admin'
import { useAddHouseholdMember } from '@/lib/data/admin'
import { cn } from '@/lib/cn'

export interface AddMemberDialogProps {
  open: boolean
  onClose: () => void
}

export function AddMemberDialog({ open, onClose }: AddMemberDialogProps) {
  const addMember = useAddHouseholdMember()

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<HouseholdRole>('member')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Reset form + mutation state whenever the dialog re-opens.
  useEffect(() => {
    if (open) {
      setEmail('')
      setDisplayName('')
      setRole('member')
      setSubmitError(null)
      setCopied(false)
      addMember.reset()
    }
    // We intentionally don't depend on `addMember` to avoid loop-on-mutation-state-change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const result: AddHouseholdMemberResult | undefined = addMember.data

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    try {
      await addMember.mutateAsync({
        email: email.trim(),
        displayName: displayName.trim(),
        role
      })
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add member')
    }
  }

  async function handleCopy(password: string) {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failed (permission denied, insecure context, etc.) — silently skip.
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[92vw] max-w-md max-h-[85vh] overflow-y-auto',
          'rounded-2xl bg-surface shadow-2xl'
        )}>
          <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
            <div>
              <Dialog.Title className="text-sm font-semibold text-ink">
                {result ? 'Member added' : 'Add member'}
              </Dialog.Title>
              {!result && (
                <Dialog.Description className="text-xs text-muted mt-0.5">
                  Create a new household member account. They&apos;ll get a temporary password to sign in with.
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          {result ? (
            <SuccessView
              result={result}
              copied={copied}
              onCopy={() => handleCopy(result.initialPassword)}
              onDone={onClose}
            />
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {submitError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Display name</span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>

              <fieldset>
                <legend className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Role</legend>
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100">
                  {(['member', 'owner'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      aria-pressed={role === r}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-sm transition-colors',
                        role === r
                          ? 'bg-white text-ink shadow-sm font-medium'
                          : 'text-muted hover:text-ink'
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="pt-2 flex justify-end gap-2">
                <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
                <button
                  type="submit"
                  disabled={addMember.isPending}
                  className={cn(
                    'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
                    'hover:bg-brand/90 disabled:opacity-60'
                  )}
                >
                  {addMember.isPending ? 'Adding…' : 'Add member'}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

interface SuccessViewProps {
  result: AddHouseholdMemberResult
  copied: boolean
  onCopy: () => void
  onDone: () => void
}

function SuccessView({ result, copied, onCopy, onDone }: SuccessViewProps) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle size={20} className="text-emerald-600" />
        <span className="text-sm font-medium">Member added</span>
      </div>

      <dl className="rounded-lg border border-rule bg-bg p-3 text-sm space-y-2">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted pt-0.5">Email</dt>
          <dd className="text-ink break-all">{result.email}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted pt-0.5">Display name</dt>
          <dd className="text-ink">{result.displayName}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted pt-0.5">Role</dt>
          <dd className="text-ink capitalize">{result.role}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-xs uppercase tracking-wider text-muted pt-0.5">User ID</dt>
          <dd className="text-ink font-mono text-xs break-all">{result.userId}</dd>
        </div>
      </dl>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
        <div className="text-xs font-medium uppercase tracking-wider text-amber-900">Initial password</div>
        <div className="flex items-center gap-2">
          <code
            className="flex-1 px-3 py-2 rounded-md bg-white border border-amber-200 font-mono text-sm text-ink select-all break-all"
            data-testid="initial-password"
          >
            {result.initialPassword}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900',
              'hover:bg-amber-100 transition'
            )}
            aria-label="Copy initial password"
          >
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p className="flex items-start gap-1.5 text-xs text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>
            Save this now — it&apos;s shown only once. Share it with the new member; they should change it on first login.
          </span>
        </p>
      </div>

      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className={cn(
            'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
            'hover:bg-brand/90'
          )}
        >
          Done
        </button>
      </div>
    </div>
  )
}
