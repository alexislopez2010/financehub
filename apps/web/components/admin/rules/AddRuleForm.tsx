'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreateBillMatchRule } from '@/lib/data/billMatchRules'
import { useCategories } from '@/lib/data/categories'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import type { BillRow } from '@/lib/data/bills'
import { cn } from '@/lib/cn'

export interface AddRuleFormProps {
  /** Owning bill for this rule, or null for the General rules group. */
  bill: BillRow | null
}

export function AddRuleForm({ bill }: AddRuleFormProps) {
  const createRule = useCreateBillMatchRule()
  const categoriesQ = useCategories()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const sortedCategories = useMemo(() => {
    const list = categoriesQ.data ?? []
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
  }, [categoriesQ.data])

  const trimmedKeyword = keyword.trim()
  const trimmedAccount = accountFilter.trim()
  const disabled = !trimmedKeyword || !category || createRule.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    setSubmitError(null)
    try {
      await createRule.mutateAsync({
        household_id: LOPEZ_HOUSEHOLD_ID,
        bill_id: bill?.id ?? null,
        bill_name: bill?.name ?? null,
        keyword: trimmedKeyword,
        category,
        account_filter: trimmedAccount || null,
        sub_category: null,
        rule_kind: 'name_keyword'
      })
      setKeyword('')
      setCategory('')
      setAccountFilter('')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to add rule')
    }
  }

  const formLabel = bill ? `Add rule for ${bill.name}` : 'Add general rule'

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={formLabel}
      className="px-4 py-3 bg-gray-50 border-t border-rule space-y-2"
    >
      {submitError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
        <input
          type="text"
          aria-label="Rule keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />

        <select
          aria-label="Rule category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Category…</option>
          {sortedCategories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>

        <input
          type="text"
          aria-label="Rule account filter"
          value={accountFilter}
          onChange={(e) => setAccountFilter(e.target.value)}
          placeholder="Account (optional)"
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
          Add rule
        </button>
      </div>
    </form>
  )
}
