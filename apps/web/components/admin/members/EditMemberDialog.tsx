'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { HouseholdMemberRow, HouseholdRole } from '@/lib/data/admin'
import { useUpdateHouseholdMember } from '@/lib/data/admin'
import { cn } from '@/lib/cn'

export interface EditMemberDialogProps {
  member: HouseholdMemberRow | null
  onClose: () => void
}

export function EditMemberDialog({ member, onClose }: EditMemberDialogProps) {
  const open = member !== null
  const updateMember = useUpdateHouseholdMember()

  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<HouseholdRole>('member')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Sync form fields whenever a new member opens the dialog.
  useEffect(() => {
    if (member) {
      setDisplayName(member.display_name ?? '')
      setRole(member.role)
      setSubmitError(null)
    }
  }, [member])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!member) return
    setSubmitError(null)
    try {
      await updateMember.mutateAsync({
        target_user: member.user_id,
        patch: {
          display_name: displayName.trim(),
          role
        }
      })
      onClose()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update member')
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
            <Dialog.Title className="text-sm font-semibold text-ink">Edit member</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Email</span>
              <div className="text-sm text-ink">{member?.email ?? ''}</div>
            </div>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Display name</span>
              <input
                type="text"
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
                disabled={updateMember.isPending}
                className={cn(
                  'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
                  'hover:bg-brand/90 disabled:opacity-60'
                )}
              >
                {updateMember.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
