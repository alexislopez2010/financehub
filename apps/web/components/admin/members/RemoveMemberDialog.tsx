'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { HouseholdMemberRow } from '@/lib/data/admin'
import { useRemoveHouseholdMember } from '@/lib/data/admin'
import { cn } from '@/lib/cn'

export interface RemoveMemberDialogProps {
  member: HouseholdMemberRow | null
  onClose: () => void
}

export function RemoveMemberDialog({ member, onClose }: RemoveMemberDialogProps) {
  const open = member !== null
  const remove = useRemoveHouseholdMember()
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setSubmitError(null)
    }
  }, [member])

  const isOwner = member?.role === 'owner'
  const displayName = member?.display_name?.trim() || member?.email || ''

  async function handleConfirm() {
    if (!member) return
    setSubmitError(null)
    try {
      await remove.mutateAsync({ target_user: member.user_id })
      onClose()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

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
            <Dialog.Title className="text-sm font-semibold text-ink">Remove member</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <p className="text-sm text-ink">
              Remove <span className="font-medium">{displayName}</span> from the household? Their
              transactions stay intact but they lose access.
            </p>

            {isOwner && (
              <p
                role="note"
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                This member is an owner. Demote them to member first.
              </p>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={remove.isPending || isOwner}
                className={cn(
                  'px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium',
                  'hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed'
                )}
              >
                {remove.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
