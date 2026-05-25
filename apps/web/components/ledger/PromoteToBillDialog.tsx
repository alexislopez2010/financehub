'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { X } from 'lucide-react'
import { useCreateBill, type BillInsert } from '@/lib/data/bills'
import type { Tables } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'

type TxRow = Tables<'transactions'>

export interface PromoteToBillDialogProps {
  tx: TxRow | null
  onClose: () => void
}

const FREQUENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Monthly',   label: 'Monthly' },
  { value: 'Biweekly',  label: 'Biweekly' },
  { value: 'Weekly',    label: 'Weekly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Annual',    label: 'Annual' }
]

function dayOfMonth(iso: string): number {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(iso)
  return m ? parseInt(m[1]!, 10) : 1
}

export function PromoteToBillDialog({ tx, onClose }: PromoteToBillDialogProps) {
  const createBill = useCreateBill()
  const open = tx !== null

  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [dueDay, setDueDay] = useState(1)
  const [frequency, setFrequency] = useState<string>('Monthly')
  const [category, setCategory] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Reset fields whenever a new tx opens the dialog.
  function syncFromTx(t: TxRow | null) {
    if (!t) return
    setName((t.description ?? '').slice(0, 80))
    setAmount(Math.abs(t.amount))
    setDueDay(dayOfMonth(t.date))
    setFrequency('Monthly')
    setCategory(t.category ?? '')
    setSubmitError(null)
  }

  // When tx changes (dialog opens), sync the form.
  // Cheap to do on every render because the comparison is by id only.
  const txId = tx?.id ?? null
  const [lastTxId, setLastTxId] = useState<string | null>(null)
  if (txId !== lastTxId) {
    setLastTxId(txId)
    syncFromTx(tx)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tx) return
    setSubmitError(null)
    try {
      const payload: BillInsert = {
        household_id: tx.household_id,
        name: name.trim() || (tx.description ?? 'Untitled bill'),
        budget_amount: Math.abs(amount),
        due_day: dueDay,
        frequency,
        category: category || null,
        account: tx.account ?? null,
        is_active: true
      }
      await createBill.mutateAsync(payload)
      onClose()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create bill')
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
            <Dialog.Title className="text-sm font-semibold text-ink">Promote to bill</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Bill name</span>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 text-sm tabular rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Due day (1–31)</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={e => setDueDay(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-1.5 text-sm tabular rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Frequency</span>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Category</span>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="(optional)"
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <div className="pt-2 flex justify-end gap-2">
              <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
              <button
                type="submit"
                disabled={createBill.isPending}
                className={cn(
                  'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
                  'hover:bg-brand/90 disabled:opacity-60'
                )}
              >
                {createBill.isPending ? 'Creating…' : 'Create bill'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
