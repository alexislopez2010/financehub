'use client'

import { Calendar, ListChecks } from 'lucide-react'
import { useMemo } from 'react'
import type { Tables } from '@/lib/supabase/database.types'
import { KpiTile } from '@/components/ui/KpiTile'
import { daysUntilDue } from '@/lib/finance/dueDate'

type Bill = Tables<'bills'>

export interface BillsSummaryProps {
  bills: ReadonlyArray<Bill>
  today: { year: number; month: number; day: number }
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function BillsSummary({ bills, today }: BillsSummaryProps) {
  const totals = useMemo(() => {
    const active = bills.filter(b => b.is_active !== false)
    let dueThisMonth = 0
    for (const b of active) {
      if (b.due_day == null) continue
      const d = daysUntilDue({ due_day: b.due_day }, today)
      if (d == null) continue
      // "this month" approximation: due within 30 days
      if (d <= 30) dueThisMonth += b.budget_amount
    }
    return { count: active.length, dueThisMonth }
  }, [bills, today])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <KpiTile
        label="Due in Next 30 Days"
        value={formatUSD(totals.dueThisMonth)}
        caption={`Across ${totals.count} active bill${totals.count === 1 ? '' : 's'}`}
        captionTone="neutral"
        icon={Calendar}
        iconTone="blue"
      />
      <KpiTile
        label="Active Bills"
        value={String(totals.count)}
        caption="Currently being tracked"
        captionTone="neutral"
        icon={ListChecks}
        iconTone="purple"
      />
    </div>
  )
}
