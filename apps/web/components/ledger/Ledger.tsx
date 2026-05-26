'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Upload } from 'lucide-react'
import { useTransactions, useUpdateTransaction, useDeleteTransaction, useUnpairTransferRow } from '@/lib/data/transactions'
import { useCategories } from '@/lib/data/categories'
import { useHouseholdMembersList } from '@/lib/data/householdMembers'
import { parseFiltersFromUrl, serializeFiltersToUrl, toDataFilters, type LedgerFilters } from '@/lib/ledger/filters'
import { FilterChips } from './FilterChips'
import { FilterSheet } from './FilterSheet'
import { TransactionList } from './TransactionList'
import { LedgerFooter } from './LedgerFooter'
import { BulkActionsBar } from './BulkActionsBar'
import { PromoteToBillDialog } from './PromoteToBillDialog'
import { ConvertToTransferDialog } from './ConvertToTransferDialog'
import type { Tables } from '@/lib/supabase/database.types'

type TxRow = Tables<'transactions'>

export function Ledger() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = parseFiltersFromUrl(new URLSearchParams(searchParams?.toString() ?? ''))

  const [filters, setFilters] = useState<LedgerFilters>(initial)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [promotingTx, setPromotingTx] = useState<TxRow | null>(null)
  const [convertingTx, setConvertingTx] = useState<TxRow | null>(null)
  const [unpairingId, setUnpairingId] = useState<string | null>(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)

  // Sync filter state → URL on every change (replace, not push, so back button still escapes Ledger)
  useEffect(() => {
    const params = serializeFiltersToUrl(filters)
    const url = params.toString().length > 0 ? `/ledger?${params.toString()}` : '/ledger'
    router.replace(url, { scroll: false })
  }, [filters, router])

  // Clear selection whenever filters change so we don't operate on hidden rows.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [filters])

  const txQ = useTransactions(toDataFilters(filters))
  const categoriesQ = useCategories()
  const membersQ = useHouseholdMembersList()
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()
  const unpairTx = useUnpairTransferRow()

  // Client-side q filter on the description.
  const filtered = (txQ.data ?? []).filter(tx => {
    if (!filters.q) return true
    return (tx.description ?? '').toLowerCase().includes(filters.q.toLowerCase())
  })

  // Category options for the inline select
  const categoryOptions = (categoriesQ.data ?? []).map(c => ({ value: c.id, label: c.name }))

  function toggleSelect(id: string, selected: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  function handleEditDescription(id: string, next: string) {
    updateTx.mutate({ id, patch: { description: next } })
  }

  function handleEditAmount(id: string, next: number) {
    // Store the magnitude; type determines sign convention for display.
    updateTx.mutate({ id, patch: { amount: next } })
  }

  function handleEditCategory(id: string, next: string) {
    const cat = categoriesQ.data?.find(c => c.id === next)
    updateTx.mutate({
      id,
      patch: next === ''
        ? { category_id: null, category: null }
        : { category_id: next, category: cat?.name ?? null }
    })
  }

  function handleEditMember(id: string, next: string | null) {
    updateTx.mutate({ id, patch: { member: next } })
  }

  async function handleBulkAssignMember(next: string | null) {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds]
    setBulkAssigning(true)
    try {
      // Per-row optimistic updates already applied + rolled back by the hook.
      // Run them in parallel; failures are surfaced via React Query but the
      // loop itself doesn't short-circuit.
      await Promise.allSettled(
        ids.map(id => updateTx.mutateAsync({ id, patch: { member: next } }))
      )
      setSelectedIds(new Set())
    } finally {
      setBulkAssigning(false)
    }
  }

  function handleDelete(id: string) {
    deleteTx.mutate(id)
    // Clear selection entry if the deleted row was selected
    if (selectedIds.has(id)) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function handleUnpair(id: string) {
    setUnpairingId(id)
    unpairTx.mutate(id, {
      onSettled() {
        setUnpairingId(prev => (prev === id ? null : prev))
      }
    })
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-ink">Ledger</h1>
          <p className="text-sm text-muted">All transactions, filterable. Bulk select + delete enabled.</p>
        </div>
        <Link
          href="/ledger/import"
          className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-sm text-ink hover:bg-bg transition shrink-0"
        >
          <Upload size={14} aria-hidden="true" />
          Import
        </Link>
      </header>

      <div className="bg-surface border border-rule rounded-xl p-3 sm:p-4 shadow-sm">
        <FilterChips
          filters={filters}
          onChange={setFilters}
          onOpenSheet={() => setSheetOpen(true)}
        />
      </div>

      {txQ.isLoading ? (
        <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
          Loading transactions…
        </div>
      ) : txQ.error ? (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-sm text-red-700">
          Failed to load: {txQ.error.message}
        </div>
      ) : (
        <TransactionList
          transactions={filtered}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          categoryOptions={categoryOptions}
          members={membersQ.data ?? []}
          onEditDescription={handleEditDescription}
          onEditAmount={handleEditAmount}
          onEditCategory={handleEditCategory}
          onEditMember={handleEditMember}
          onPromote={tx => setPromotingTx(tx)}
          onDelete={handleDelete}
          onConvertToTransfer={tx => setConvertingTx(tx)}
          onUnpairTransfer={handleUnpair}
          unpairingId={unpairingId}
        />
      )}

      <LedgerFooter transactions={filtered} />

      <BulkActionsBar
        selectedIds={[...selectedIds]}
        onCancel={clearSelection}
        onCompleted={clearSelection}
        members={membersQ.data ?? []}
        onAssignMember={handleBulkAssignMember}
        isAssigning={bulkAssigning}
      />

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        onChange={setFilters}
      />

      <PromoteToBillDialog
        tx={promotingTx}
        onClose={() => setPromotingTx(null)}
      />

      <ConvertToTransferDialog
        open={convertingTx !== null}
        onOpenChange={o => { if (!o) setConvertingTx(null) }}
        sourceTransaction={convertingTx}
        allTransactions={txQ.data ?? []}
      />
    </div>
  )
}
