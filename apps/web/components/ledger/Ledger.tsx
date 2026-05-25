'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransactions } from '@/lib/data/transactions'
import { parseFiltersFromUrl, serializeFiltersToUrl, toDataFilters, type LedgerFilters } from '@/lib/ledger/filters'
import { FilterChips } from './FilterChips'
import { FilterSheet } from './FilterSheet'
import { TransactionList } from './TransactionList'

export function Ledger() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial = parseFiltersFromUrl(new URLSearchParams(searchParams?.toString() ?? ''))

  const [filters, setFilters] = useState<LedgerFilters>(initial)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Sync filter state → URL on every change (replace, not push, so back button still escapes Ledger)
  useEffect(() => {
    const params = serializeFiltersToUrl(filters)
    const url = params.toString().length > 0 ? `/ledger?${params.toString()}` : '/ledger'
    router.replace(url, { scroll: false })
  }, [filters, router])

  const txQ = useTransactions(toDataFilters(filters))

  // Client-side q filter on the description.
  const filtered = (txQ.data ?? []).filter(tx => {
    if (!filters.q) return true
    return (tx.description ?? '').toLowerCase().includes(filters.q.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-ink">Ledger</h1>
        <p className="text-sm text-muted">All transactions, filterable. Inline edit + bulk actions coming in the next pass.</p>
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
        <TransactionList transactions={filtered} />
      )}

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        onChange={setFilters}
      />
    </div>
  )
}
