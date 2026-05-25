'use client'

import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useDeleteTransaction } from '@/lib/data/transactions'
import { cn } from '@/lib/cn'

export interface BulkActionsBarProps {
  selectedIds: ReadonlyArray<string>
  onCancel: () => void
  onCompleted: () => void
}

export function BulkActionsBar({ selectedIds, onCancel, onCompleted }: BulkActionsBarProps) {
  const deleteTx = useDeleteTransaction()
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  if (selectedIds.length === 0) return null

  async function handleDelete() {
    setIsDeleting(true)
    try {
      // Per-row optimistic delete via the hook. We await all in parallel.
      await Promise.allSettled(
        selectedIds.map(id => deleteTx.mutateAsync(id))
      )
    } finally {
      setIsDeleting(false)
      setConfirming(false)
      onCompleted()
    }
  }

  return (
    <div
      role="region"
      aria-label={`${selectedIds.length} transactions selected`}
      className={cn(
        'sticky bottom-16 sm:bottom-16 z-20',
        'bg-ink text-white rounded-xl shadow-lg',
        'mx-auto max-w-md',
        'px-4 py-3 flex items-center justify-between gap-3'
      )}
    >
      <div className="text-sm font-medium tabular">
        {selectedIds.length} selected
      </div>
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirming(false)}
              className="text-xs text-white/70 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500',
                'text-white text-xs font-medium px-3 py-1.5',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              <Trash2 size={12} />
              {isDeleting ? 'Deleting…' : `Yes, delete ${selectedIds.length}`}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg',
                'text-white text-xs font-medium px-3 py-1.5',
                'hover:bg-white/10'
              )}
            >
              <Trash2 size={12} />
              Delete
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel selection"
              className="text-white/70 hover:text-white p-1"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
