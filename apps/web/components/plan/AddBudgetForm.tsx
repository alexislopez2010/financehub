'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'

type CategoryRow = Tables<'categories'>

export interface AddBudgetFormProps {
  /** Categories that don't yet have a budget in this period. */
  availableCategories: ReadonlyArray<CategoryRow>
  /** Optional preselected category (e.g., when promoting an unbudgeted-spend row). */
  initialCategoryId?: string | null
  initialCategoryName?: string | null
  isSubmitting: boolean
  onSubmit: (input: { category: string; categoryId: string | null; amount: number }) => void
  onCancel?: () => void
}

export function AddBudgetForm({
  availableCategories,
  initialCategoryId,
  initialCategoryName,
  isSubmitting,
  onSubmit,
  onCancel
}: AddBudgetFormProps) {
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ?? '')
  const [customName, setCustomName] = useState<string>(initialCategoryName ?? '')
  const [amount, setAmount] = useState<string>('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt < 0) return

    if (categoryId) {
      const cat = availableCategories.find(c => c.id === categoryId)
      if (!cat) return
      onSubmit({ category: cat.name, categoryId: cat.id, amount: amt })
    } else if (customName.trim()) {
      onSubmit({ category: customName.trim(), categoryId: null, amount: amt })
    }
    setCategoryId('')
    setCustomName('')
    setAmount('')
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_120px_28px] sm:grid-cols-[1fr_140px_28px] gap-3 items-center px-4 py-3 bg-gray-50 border-t border-rule">
      {availableCategories.length > 0 && !initialCategoryName ? (
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          required
        >
          <option value="">Pick a category…</option>
          {availableCategories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={customName}
          onChange={e => setCustomName(e.target.value)}
          placeholder="Category name"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          required
        />
      )}

      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="$0.00"
        className="text-sm tabular text-right rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        required
      />

      <div className="flex items-center justify-end gap-1">
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Add budget"
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-md text-white',
            'bg-brand hover:bg-brand/90 disabled:opacity-60'
          )}
        >
          <Plus size={14} />
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </form>
  )
}
