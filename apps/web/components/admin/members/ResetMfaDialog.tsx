'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { HouseholdMemberRow } from '@/lib/data/admin'
import { useResetMfa } from '@/lib/data/admin'
import { cn } from '@/lib/cn'

export interface ResetMfaDialogProps {
  member: HouseholdMemberRow | null
  onClose: () => void
}

export function ResetMfaDialog({ member, onClose }: ResetMfaDialogProps) {
  const open = member !== null
  const reset = useResetMfa()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [removed, setRemoved] = useState<number | null>(null)

  // Reset transient state on each open.
  useEffect(() => {
    if (member) {
      setSubmitError(null)
      setRemoved(null)
    }
  }, [member])

  async function handleConfirm() {
    if (!member) return
    setSubmitError(null)
    try {
      const count = await reset.mutateAsync({ target_user: member.user_id })
      setRemoved(count)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to reset MFA')
    }
  }

  const displayName = member?.display_name?.trim() || member?.email || ''

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
            <Dialog.Title className="text-sm font-semibold text-ink">Reset MFA</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {removed === null ? (
              <p className="text-sm text-ink">
                Reset MFA for <span className="font-medium">{displayName}</span>? They will need to
                re-enroll on next login.
              </p>
            ) : (
              <p role="status" className="rounded-lg border border-rule bg-bg px-3 py-2 text-sm text-ink">
                Removed {removed} {removed === 1 ? 'factor' : 'factors'}. The user will be prompted to
                re-enroll on next login.
              </p>
            )}

            <div className="pt-2 flex justify-end gap-2">
              {removed === null ? (
                <>
                  <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={reset.isPending}
                    className={cn(
                      'px-4 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium',
                      'hover:bg-amber-700 disabled:opacity-60'
                    )}
                  >
                    {reset.isPending ? 'Resetting…' : 'Reset MFA'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-ink text-bg text-sm font-medium hover:bg-ink/90"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
