'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useBills, useCreateBill, useUpdateBill, useDeleteBill } from '@/lib/data/bills'
import { parseSortKey, type BillSortKey } from '@/lib/bills/sort'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { BillsSummary } from './BillsSummary'
import { BillList } from './BillList'
import { AddBillForm } from './AddBillForm'

export function Bills() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSort: BillSortKey = parseSortKey(searchParams?.get('sort') ?? null) ?? 'due'

  const [sortKey, setSortKey] = useState<BillSortKey>(initialSort)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    const url = `/bills?sort=${sortKey}`
    router.replace(url, { scroll: false })
  }, [sortKey, router])

  const billsQ = useBills()
  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const deleteBill = useDeleteBill()

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }, [])

  const bills = billsQ.data ?? []

  function handleCreate(input: {
    name: string; category: string | null; due_day: number | null;
    frequency: string; budget_amount: number; account: string | null
  }) {
    createBill.mutate({
      household_id: LOPEZ_HOUSEHOLD_ID,
      name: input.name,
      category: input.category,
      due_day: input.due_day,
      frequency: input.frequency,
      budget_amount: input.budget_amount,
      account: input.account,
      is_active: true
    })
    setShowAddForm(false)
  }

  function handleEditName(id: string, next: string) {
    updateBill.mutate({ id, patch: { name: next } })
  }
  function handleEditDueDay(id: string, next: number) {
    updateBill.mutate({ id, patch: { due_day: next } })
  }
  function handleEditAmount(id: string, next: number) {
    updateBill.mutate({ id, patch: { budget_amount: next } })
  }
  function handleDelete(id: string, name: string) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete bill "${name}"?`)) return
    deleteBill.mutate(id)
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Bills</h1>
          <p className="text-sm text-muted">Recurring obligations, sorted by next due date.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90"
        >
          <Plus size={14} />
          Add bill
        </button>
      </header>

      <BillsSummary bills={bills} today={today} />

      {billsQ.isLoading ? (
        <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
          Loading…
        </div>
      ) : billsQ.error ? (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-sm text-red-700">
          Failed to load: {billsQ.error.message}
        </div>
      ) : (
        <>
          {showAddForm && (
            <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
              <AddBillForm
                isSubmitting={createBill.isPending}
                onSubmit={handleCreate}
                onCancel={() => setShowAddForm(false)}
              />
            </section>
          )}
          <BillList
            bills={bills}
            sortKey={sortKey}
            onSortChange={setSortKey}
            today={today}
            onEditName={handleEditName}
            onEditDueDay={handleEditDueDay}
            onEditAmount={handleEditAmount}
            onDelete={handleDelete}
          />
        </>
      )}
    </div>
  )
}
