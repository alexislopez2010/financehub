'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AddBillFormProps {
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

export function AddBillForm({ isSubmitting, onSubmit, onCancel }: AddBillFormProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [frequency, setFrequency] = useState('Monthly')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')

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

    onSubmit({
      name: trimmedName,
      category: category.trim() || null,
      due_day: due,
      frequency,
      budget_amount: amt,
      account: account.trim() || null
    })
    setName(''); setCategory(''); setDueDay(''); setFrequency('Monthly'); setAmount(''); setAccount('')
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-50 border-t border-rule space-y-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Bill name"
        className="w-full text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        required
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          placeholder="Category"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <select
          value={frequency}
          onChange={e => setFrequency(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
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
        />
      </div>
      <div className="grid grid-cols-[1fr_28px_28px] gap-2 items-center">
        <input
          type="text"
          value={account}
          onChange={e => setAccount(e.target.value)}
          placeholder="Account (optional)"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
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
