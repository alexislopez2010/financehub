'use client'

import { Calendar, DollarSign, Receipt } from 'lucide-react'
import { KpiTile } from '@/components/ui/KpiTile'
import type { PayoffPlan } from '@/lib/finance/debt'

export interface PayoffSummaryProps {
  plan: PayoffPlan
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthsLabel(m: number, capped: boolean): string {
  if (m === 0) return 'No debt'
  if (!capped) {
    const years = Math.floor(m / 12)
    const rem = m % 12
    if (years === 0) return `${m} months`
    if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`
    return `${years}y ${rem}m`
  }
  return `> ${m} months`
}

export function PayoffSummary({ plan }: PayoffSummaryProps) {
  const capped = !plan.paidOff
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <KpiTile
        label="Time to Payoff"
        value={monthsLabel(plan.monthsToPayoff, capped)}
        caption={capped ? 'Hit safety cap (try more extra)' : 'Until last debt clears'}
        captionTone={capped ? 'negative' : 'neutral'}
        icon={Calendar}
        iconTone={capped ? 'red' : 'blue'}
      />
      <KpiTile
        label="Total Interest"
        value={formatUSD(plan.totalInterest)}
        caption="Paid over the simulation window"
        captionTone="neutral"
        icon={Receipt}
        iconTone="amber"
      />
      <KpiTile
        label="Total Paid"
        value={formatUSD(plan.totalPaid)}
        caption="Principal + interest + escrow"
        captionTone="neutral"
        icon={DollarSign}
        iconTone="emerald"
      />
    </div>
  )
}
