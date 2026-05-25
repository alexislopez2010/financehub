'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBills } from '@/lib/data/bills'
import { parseSortKey, type BillSortKey } from '@/lib/bills/sort'
import { BillsSummary } from './BillsSummary'
import { BillList } from './BillList'

export function Bills() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSort: BillSortKey = parseSortKey(searchParams?.get('sort') ?? null) ?? 'due'

  const [sortKey, setSortKey] = useState<BillSortKey>(initialSort)

  useEffect(() => {
    const url = `/bills?sort=${sortKey}`
    router.replace(url, { scroll: false })
  }, [sortKey, router])

  const billsQ = useBills()

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }, [])

  const bills = billsQ.data ?? []

  return (
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Bills</h1>
        <p className="text-sm text-muted">Recurring obligations, sorted by next due date.</p>
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
        <BillList bills={bills} sortKey={sortKey} onSortChange={setSortKey} today={today} />
      )}
    </div>
  )
}
