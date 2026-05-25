'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AddIncomeFormProps {
  isSubmitting: boolean
  onSubmit: (input: {
    source: string
    member: string | null
    frequency: string
    expected_amount: number
  }) => void
  onCancel?: () => void
}

const FREQUENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Monthly',     label: 'Monthly' },
  { value: 'Semimonthly', label: 'Semimonthly' },
  { value: 'Biweekly',    label: 'Biweekly' },
  { value: 'Weekly',      label: 'Weekly' },
  { value: 'Annual',      label: 'Annual' },
  { value: 'One-time',    label: 'One-time' }
]

export function AddIncomeForm({ isSubmitting, onSubmit, onCancel }: AddIncomeFormProps) {
  const [source, setSource] = useState('')
  const [member, setMember] = useState('')
  const [frequency, setFrequency] = useState<string>('Monthly')
  const [amount, setAmount] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(amount)
    if (Number.isNaN(amt) || amt < 0) return
    const trimmedSource = source.trim()
    if (!trimmedSource) return

    onSubmit({
      source: trimmedSource,
      member: member.trim() || null,
      frequency,
      expected_amount: amt
    })
    setSource('')
    setMember('')
    setFrequency('Monthly')
    setAmount('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 bg-gray-50 border-t border-rule space-y-2"
    >
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
        <input
          type="text"
          value={source}
          onChange={e => setSource(e.target.value)}
          placeholder="Source (e.g., Omnicom Shared Services)"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
          required
        />
        <input
          type="text"
          value={member}
          onChange={e => setMember(e.target.value)}
          placeholder="Member (optional)"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div className="grid grid-cols-[1fr_120px_28px] sm:grid-cols-[1fr_140px_28px] gap-2 items-center">
        <select
          value={frequency}
          onChange={e => setFrequency(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
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
            aria-label="Add income plan"
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
      </div>
    </form>
  )
}
