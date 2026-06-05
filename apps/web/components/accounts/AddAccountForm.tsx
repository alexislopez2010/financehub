'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

const TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'checking',   label: 'Checking' },
  { value: 'savings',    label: 'Savings' },
  { value: 'credit',     label: 'Credit card' },
  { value: 'loan',       label: 'Loan' },
  { value: 'mortgage',   label: 'Mortgage' },
  { value: 'investment', label: 'Investment' },
  { value: 'property',   label: 'Property' }
]

export interface AddAccountFormProps {
  isSubmitting: boolean
  onSubmit: (input: {
    name: string
    type: string
    institution: string | null
    starting_balance: number
  }) => void
  onCancel?: () => void
}

export function AddAccountForm({ isSubmitting, onSubmit, onCancel }: AddAccountFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState('checking')
  const [institution, setInstitution] = useState('')
  const [startingBalance, setStartingBalance] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const sb = parseFloat(startingBalance)
    if (Number.isNaN(sb)) return
    const trimmedName = name.trim()
    if (!trimmedName) return
    onSubmit({
      name: trimmedName,
      type,
      institution: institution.trim() || null,
      starting_balance: sb
    })
    setName(''); setType('checking'); setInstitution(''); setStartingBalance('')
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 bg-gray-50 border-t border-rule space-y-2">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Account name"
        required
        className="w-full text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        >
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          type="text"
          value={institution}
          onChange={e => setInstitution(e.target.value)}
          placeholder="Institution"
          className="text-sm rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <input
          type="number"
          step="0.01"
          value={startingBalance}
          onChange={e => setStartingBalance(e.target.value)}
          placeholder="Starting balance"
          required
          className="text-sm tabular text-right rounded-md border border-rule px-2 py-1.5 bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">Cancel</button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-white',
            'bg-brand hover:bg-brand/90 disabled:opacity-60'
          )}
        >
          <Plus size={14} />
          Add account
        </button>
      </div>
    </form>
  )
}
