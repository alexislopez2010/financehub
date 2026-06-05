'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Layers } from 'lucide-react'
import { useBills, useCreateBill, useUpdateBill, useDeleteBill } from '@/lib/data/bills'
import { useCategories } from '@/lib/data/categories'
import { useAccounts } from '@/lib/data/accounts'
import { parseSortKey, type BillSortKey } from '@/lib/bills/sort'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { BillsSummary } from './BillsSummary'
import { BillList } from './BillList'
import { AddBillForm } from './AddBillForm'
import { BillsBudgetMappingDialog } from './BillsBudgetMappingDialog'

export function Bills() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSort: BillSortKey = parseSortKey(searchParams?.get('sort') ?? null) ?? 'due'

  const [sortKey, setSortKey] = useState<BillSortKey>(initialSort)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showMappingDialog, setShowMappingDialog] = useState(false)

  useEffect(() => {
    const url = `/bills?sort=${sortKey}`
    router.replace(url, { scroll: false })
  }, [sortKey, router])

  const billsQ = useBills()
  const categoriesQ = useCategories()
  const accountsQ = useAccounts()
  const createBill = useCreateBill()
  const updateBill = useUpdateBill()
  const deleteBill = useDeleteBill()

  // Strip everything AddBillForm doesn't need so we don't leak full DB rows
  // into the form component's prop surface.
  const categoryOptions = useMemo(
    () => (categoriesQ.data ?? []).map(c => ({ name: c.name, type: c.type })),
    [categoriesQ.data]
  )
  const accountOptions = useMemo(
    () => (accountsQ.data ?? []).map(a => ({ name: a.name })),
    [accountsQ.data]
  )

  // Lowercase-name → category row id. Lets handleCreate set
  // `budget_category_id` whenever the user picked a canonical category from
  // the dropdown, instead of leaving the FK NULL and silently dropping the
  // bill out of Plan rollups.
  const categoryIdByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categoriesQ.data ?? []) {
      const key = c.name.trim().toLowerCase()
      if (key) map.set(key, c.id)
    }
    return map
  }, [categoriesQ.data])

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }, [])

  const bills = billsQ.data ?? []

  function handleCreate(input: {
    name: string; category: string | null; due_day: number | null;
    frequency: string; budget_amount: number; account: string | null;
    due_month_anchor: number | null
  }) {
    // Resolve the FK from the canonical category name so new bills are
    // immediately picked up by the Plan rollup. NULL is fine here — it just
    // means the user typed a custom category that doesn't match any row in
    // the categories table (free-text path); the bill stays unmapped until
    // the user fixes it via the per-bill inline budget category picker.
    const categoryKey = input.category?.trim().toLowerCase() ?? ''
    const budgetCategoryId = categoryKey ? (categoryIdByName.get(categoryKey) ?? null) : null
    createBill.mutate({
      household_id: LOPEZ_HOUSEHOLD_ID,
      name: input.name,
      category: input.category,
      budget_category_id: budgetCategoryId,
      due_day: input.due_day,
      frequency: input.frequency,
      budget_amount: input.budget_amount,
      account: input.account,
      due_month_anchor: input.due_month_anchor,
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMappingDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rule bg-surface text-ink text-sm font-medium hover:bg-gray-50"
          >
            <Layers size={14} />
            Map to budget categories
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90"
          >
            <Plus size={14} />
            Add bill
          </button>
        </div>
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
                categoryOptions={categoryOptions}
                accountOptions={accountOptions}
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

      <BillsBudgetMappingDialog
        open={showMappingDialog}
        onOpenChange={setShowMappingDialog}
      />
    </div>
  )
}
