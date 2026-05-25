'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Trash2, X } from 'lucide-react'
import { EditableCell } from '@/components/ledger/EditableCell'
import { useUpdateCategory, useDeleteCategory, type CategoryRow as CategoryRowType } from '@/lib/data/categories'
import { cn } from '@/lib/cn'

export interface CategoryRowProps {
  category: CategoryRowType
}

export function CategoryRow({ category }: CategoryRowProps) {
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleRename(next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === category.name) return
    updateCategory.mutate({ id: category.id, patch: { name: trimmed } })
  }

  async function handleConfirmDelete() {
    setSubmitError(null)
    try {
      await deleteCategory.mutateAsync(category.id)
      setConfirmOpen(false)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete category')
    }
  }

  return (
    <li className="group flex items-center gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <EditableCell
          variant="text"
          value={category.name}
          onCommit={handleRename}
          display={<span className="text-ink truncate">{category.name}</span>}
        />
      </div>

      <Dialog.Root open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setSubmitError(null) }}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            aria-label={`Delete ${category.name}`}
            className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Dialog.Content className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[92vw] max-w-md',
            'rounded-2xl bg-surface shadow-2xl'
          )}>
            <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold text-ink">Delete category</Dialog.Title>
              <Dialog.Close className="text-muted hover:text-ink" aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>

            <div className="p-5 space-y-4">
              {submitError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <p className="text-sm text-ink">
                Delete <span className="font-medium">{category.name}</span>?
              </p>
              <p className="text-xs text-muted">
                Transactions in this category will become Uncategorized.
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleteCategory.isPending}
                  className={cn(
                    'px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium',
                    'hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed'
                  )}
                >
                  {deleteCategory.isPending ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </li>
  )
}
