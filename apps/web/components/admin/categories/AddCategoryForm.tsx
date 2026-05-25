'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreateCategory } from '@/lib/data/categories'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { cn } from '@/lib/cn'

type CategoryType = 'expense' | 'income'

export function AddCategoryForm() {
  const createCategory = useCreateCategory()
  const [type, setType] = useState<CategoryType>('expense')
  const [parent, setParent] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const trimmedName = name.trim()
  const trimmedParent = parent.trim()
  const disabled = !trimmedName || createCategory.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    setSubmitError(null)
    try {
      await createCategory.mutateAsync({
        household_id: LOPEZ_HOUSEHOLD_ID,
        type,
        name: trimmedName,
        parent_category: trimmedParent || null
      })
      setName('')
      setParent('')
      // Leave `type` as the user's last selection — likely useful for batch adds.
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add category')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 bg-gray-50 border-t border-rule space-y-2"
    >
      {submitError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_auto] gap-2 items-center">
        <select
          aria-label="Category type"
          value={type}
          onChange={(e) => setType(e.target.value as CategoryType)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>

        <input
          type="text"
          aria-label="Parent category"
          value={parent}
          onChange={(e) => setParent(e.target.value)}
          placeholder="Parent (optional)"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <input
          type="text"
          aria-label="Category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <button
          type="submit"
          disabled={disabled}
          className={cn(
            'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white',
            'bg-brand hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed'
          )}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </form>
  )
}
