'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { FamilyMemberRow } from '@/lib/data/familyMembers'
import { useUpdateFamilyMember } from '@/lib/data/familyMembers'
import { cn } from '@/lib/cn'

export interface EditPlaceholderDialogProps {
  placeholder: FamilyMemberRow | null
  onClose: () => void
}

export function EditPlaceholderDialog({ placeholder, onClose }: EditPlaceholderDialogProps) {
  const open = placeholder !== null
  const update = useUpdateFamilyMember()

  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (placeholder) {
      setName(placeholder.name)
      setRelationship(placeholder.relationship ?? '')
      setSubmitError(null)
    }
  }, [placeholder])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!placeholder) return
    setSubmitError(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setSubmitError('Name is required')
      return
    }
    try {
      const trimmedRel = relationship.trim()
      await update.mutateAsync({
        id: placeholder.id,
        patch: {
          name: trimmedName,
          relationship: trimmedRel.length > 0 ? trimmedRel : null
        }
      })
      onClose()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update placeholder')
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
            <Dialog.Title className="text-sm font-semibold text-ink">Edit placeholder</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">
                Relationship <span className="text-muted/70 normal-case font-normal">(optional)</span>
              </span>
              <input
                type="text"
                value={relationship}
                onChange={e => setRelationship(e.target.value)}
                placeholder="e.g. Son, Daughter"
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
              <button
                type="submit"
                disabled={update.isPending}
                className={cn(
                  'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
                  'hover:bg-brand/90 disabled:opacity-60'
                )}
              >
                {update.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
