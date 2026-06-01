'use client'

import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface CategoryOption {
  readonly name: string
  readonly type: 'expense' | 'income' | string  // schema permits any string; expense/income are the canonical values
}

export interface AccountOption {
  readonly name: string
}

export interface AddBillFormProps {
  /** Categories surfaced as grouped options. Pulled from the `categories` table by the parent. */
  categoryOptions: ReadonlyArray<CategoryOption>
  /** Accounts surfaced as options. Pulled from the `accounts` table by the parent. */
  accountOptions: ReadonlyArray<AccountOption>
  isSubmitting: boolean
  onSubmit: (input: {
    name: string
    category: string | null
    due_day: number | null
    frequency: string
    budget_amount: number
    account: string | null
  }) => void
  onCancel?: () => void
}

const FREQUENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Monthly',   label: 'Monthly' },
  { value: 'Biweekly',  label: 'Biweekly' },
  { value: 'Weekly',    label: 'Weekly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Annual',    label: 'Annual' }
]

// Sentinel value for the "Other…" option that reveals a free-text input.
// Bills.category is a free-text column, so we keep an escape hatch for
// categories users haven't formalized in the `categories` table.
const OTHER_CATEGORY = '__other__'

export function AddBillForm({
  categoryOptions,
  accountOptions,
  isSubmitting,
  onSubmit,
  onCancel
}: AddBillFormProps) {
  const [name, setName] = useState('')
  const [categorySelect, setCategorySelect] = useState('')  // '' = unselected, OTHER_CATEGORY = custom
  const [categoryCustom, setCategoryCustom] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [frequency, setFrequency] = useState('Monthly')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')  // '' = unselected (writes null)

  const grouped = useMemo(() => groupCategoriesByType(categoryOptions), [categoryOptions])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt < 0) return
    const trimmedName = name.trim()
    if (!trimmedName) return

    let due: number | null = null
    if (dueDay.trim()) {
      const d = parseInt(dueDay, 10)
      if (!Number.isNaN(d) && d >= 1 && d <= 31) due = d
    }

    const resolvedCategory =
      categorySelect === OTHER_CATEGORY
        ? (categoryCustom.trim() || null)
        : (categorySelect.trim() || null)

    onSubmit({
      name: trimmedName,
      category: resolvedCategory,
      due_day: due,
      frequency,
      budget_amount: amt,
      account: account.trim() || null
    })
    setName('')
    setCategorySelect('')
    setCategoryCustom('')
    setDueDay('')
    setFrequency('Monthly')
    setAmount('')
    setAccount('')
  }

  const showCustomCategoryInput = categorySelect === OTHER_CATEGORY

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-50 border-t border-rule space-y-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Bill name"
        className="w-full text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        required
        aria-label="Bill name"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select
          value={categorySelect}
          onChange={e => setCategorySelect(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          aria-label="Category"
        >
          <option value="">Category…</option>
          {grouped.expense.length > 0 && (
            <optgroup label="Expense">
              {grouped.expense.map(c => (
                <option key={`exp-${c.name}`} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
          )}
          {grouped.income.length > 0 && (
            <optgroup label="Income">
              {grouped.income.map(c => (
                <option key={`inc-${c.name}`} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
          )}
          {grouped.other.length > 0 && (
            <optgroup label="Other">
              {grouped.other.map(c => (
                <option key={`oth-${c.name}`} value={c.name}>{c.name}</option>
              ))}
            </optgroup>
          )}
          <option value={OTHER_CATEGORY}>Other…</option>
        </select>
        <select
          value={frequency}
          onChange={e => setFrequency(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          aria-label="Frequency"
        >
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input
          type="number"
          min="1" max="31"
          value={dueDay}
          onChange={e => setDueDay(e.target.value)}
          placeholder="Day"
          className="text-sm tabular text-right rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          aria-label="Due day of month"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="$0.00"
          className="text-sm tabular text-right rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          required
          aria-label="Amount"
        />
      </div>
      {showCustomCategoryInput && (
        <input
          type="text"
          value={categoryCustom}
          onChange={e => setCategoryCustom(e.target.value)}
          placeholder="Custom category name"
          aria-label="Custom category name"
          className="w-full text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      )}
      <div className="grid grid-cols-[1fr_28px_28px] gap-2 items-center">
        <select
          value={account}
          onChange={e => setAccount(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          aria-label="Account (optional)"
        >
          <option value="">Account (optional)…</option>
          {accountOptions.map(a => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Add bill"
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

/**
 * Splits the supplied category list into Expense / Income / Other buckets for
 * grouped rendering. Pure — easy to unit-test in isolation. Sorts each bucket
 * alphabetically and de-dupes by name (case-insensitive) so accidental
 * duplicates in the categories table don't produce repeated options.
 */
export function groupCategoriesByType(
  options: ReadonlyArray<CategoryOption>
): { expense: ReadonlyArray<CategoryOption>; income: ReadonlyArray<CategoryOption>; other: ReadonlyArray<CategoryOption> } {
  const expense: CategoryOption[] = []
  const income: CategoryOption[] = []
  const other: CategoryOption[] = []
  const seen = new Set<string>()
  for (const opt of options) {
    const key = opt.name.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (opt.type === 'expense') expense.push(opt)
    else if (opt.type === 'income') income.push(opt)
    else other.push(opt)
  }
  const byName = (a: CategoryOption, b: CategoryOption) => a.name.localeCompare(b.name)
  return {
    expense: expense.sort(byName),
    income: income.sort(byName),
    other: other.sort(byName)
  }
}
