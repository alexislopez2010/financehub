'use client'

import { useMemo } from 'react'
import type { Tables } from '@/lib/supabase/database.types'
import { useTransactions } from '@/lib/data/transactions'
import { useBillMatchRules } from '@/lib/data/billMatchRules'
import { useCategories } from '@/lib/data/categories'
import { useUpdateBill } from '@/lib/data/bills'
import { matchBills } from '@/lib/finance/billsMatch'
import { periodToRange } from '@/lib/plan/period'
import { cn } from '@/lib/cn'

type Bill = Tables<'bills'>

export interface BillExpandedProps {
  bill: Bill
  today: { year: number; month: number; day: number }
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDay(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${parseInt(m[1]!, 10)}/${parseInt(m[2]!, 10)}`
}

export function BillExpanded({ bill, today }: BillExpandedProps) {
  const range = periodToRange({ year: today.year, month: today.month })
  const txsQ = useTransactions({ startDate: range.startDate, endDate: range.endDate })
  const rulesQ = useBillMatchRules()
  const categoriesQ = useCategories()
  const updateBill = useUpdateBill()

  const categories = categoriesQ.data ?? []

  function handleBudgetCategoryChange(nextId: string | null): void {
    updateBill.mutate({ id: bill.id, patch: { budget_category_id: nextId } })
  }

  const matches = useMemo(() => {
    const allTxs = txsQ.data ?? []
    const allRules = rulesQ.data ?? []
    if (allTxs.length === 0) return { matchedTransactions: [], totalAmount: 0, count: 0 }
    // matchBills' types want lib/finance/types.ts shapes; cast through unknown
    // (the algorithm only reads description, category, account, amount, id).
    const results = matchBills(
      [bill] as unknown as Parameters<typeof matchBills>[0],
      allTxs as unknown as Parameters<typeof matchBills>[1],
      allRules as unknown as Parameters<typeof matchBills>[2]
    )
    return results[0] ?? { matchedTransactions: [], totalAmount: 0, count: 0 }
  }, [bill, txsQ.data, rulesQ.data])

  const isLoading = txsQ.isLoading || rulesQ.isLoading
  const variance = bill.budget_amount - matches.totalAmount

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-rule space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
          Budget category
        </span>
        <select
          aria-label={`Budget category for ${bill.name}`}
          value={bill.budget_category_id ?? ''}
          disabled={categoriesQ.isLoading || updateBill.isPending}
          onChange={e => handleBudgetCategoryChange(e.target.value === '' ? null : e.target.value)}
          className={cn(
            'rounded-md border border-rule bg-surface px-2 py-1 text-xs text-ink',
            'disabled:opacity-60'
          )}
        >
          <option value="">(none)</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {!bill.budget_category_id && (
          <span className="text-[11px] text-muted italic">
            Unmapped — payments won&apos;t roll up to a budget bucket.
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="text-xs text-muted text-center py-2">Loading matches…</div>
      ) : matches.count === 0 ? (
        <div className="text-xs text-muted italic text-center py-3">
          No matching transactions this month. Adjust this bill&apos;s match rules in Admin (Phase 2L).
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
              Matched this month
            </div>
            <div className="text-xs tabular text-muted">
              <span className="text-ink font-semibold">{matches.count}</span> match{matches.count === 1 ? '' : 'es'} ·{' '}
              <span className="text-ink font-semibold">{formatUSD(matches.totalAmount)}</span> ·{' '}
              <span className={cn(
                'font-semibold',
                variance < 0 ? 'text-red-600' : variance > 0 ? 'text-emerald-600' : 'text-muted'
              )}>
                {variance < 0 ? '−' : variance > 0 ? '+' : ''}
                {formatUSD(Math.abs(variance))}
              </span>
            </div>
          </div>
          <ul className="bg-surface rounded-md border border-rule divide-y divide-gray-100 overflow-hidden">
            {matches.matchedTransactions.map((tx) => (
              <li
                key={tx.id}
                className="grid grid-cols-[60px_1fr_100px] gap-3 px-3 py-2 text-xs items-center"
              >
                <div className="text-muted tabular">{formatDay(tx.date)}</div>
                <div className="text-ink truncate" title={tx.description}>{tx.description}</div>
                <div className="text-right tabular font-medium text-ink">
                  {formatUSD(Math.abs(tx.amount))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
