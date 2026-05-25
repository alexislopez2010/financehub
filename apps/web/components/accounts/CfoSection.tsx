'use client'

import { useMemo } from 'react'
import { TrendingUp, TrendingDown, PiggyBank, Scale, Coins, Receipt, Calendar, Wallet } from 'lucide-react'
import { useAccounts } from '@/lib/data/accounts'
import { useTransactions } from '@/lib/data/transactions'
import { useDebts } from '@/lib/data/debts'
import { deriveBalances } from '@/lib/accounts/balances'
import { deriveCfoKpis } from '@/lib/accounts/cfo'
import { KpiTile } from '@/components/ui/KpiTile'

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatPct(decimal: number): string {
  return `${(decimal * 100).toFixed(1)}%`
}

function formatMonths(n: number): string {
  if (n === 0) return '—'
  if (n >= 12) {
    const years = n / 12
    return `${years.toFixed(1)} yr`
  }
  return `${n.toFixed(1)} mo`
}

export function CfoSection() {
  const accountsQ = useAccounts()
  const txsQ = useTransactions()
  const debtsQ = useDebts()

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
  }, [])

  const summary = useMemo(() => deriveBalances({
    accounts: accountsQ.data ?? [],
    transactions: txsQ.data ?? []
  }), [accountsQ.data, txsQ.data])

  const kpis = useMemo(() => deriveCfoKpis({
    summary,
    transactions: txsQ.data ?? [],
    debts: debtsQ.data ?? [],
    today
  }), [summary, txsQ.data, debtsQ.data, today])

  if (accountsQ.isLoading || txsQ.isLoading || debtsQ.isLoading) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        Loading CFO view…
      </div>
    )
  }

  const error = accountsQ.error || txsQ.error || debtsQ.error
  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-sm text-red-700">
        Failed to load: {error.message}
      </div>
    )
  }

  const netWorthTone = kpis.netWorth >= 0 ? 'positive' : 'negative'
  const savingsTone = kpis.savingsRate >= 0.2 ? 'positive' : kpis.savingsRate >= 0 ? 'neutral' : 'negative'
  const dtiTone = kpis.debtToIncomeRatio < 0.36 ? 'positive' : kpis.debtToIncomeRatio < 0.5 ? 'neutral' : 'negative'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Net Worth"
          value={formatUSD(kpis.netWorth)}
          caption={kpis.netWorth >= 0 ? 'Cash + Investments − Debt' : 'Liabilities exceed assets'}
          captionTone={netWorthTone}
          icon={Scale}
          iconTone={kpis.netWorth >= 0 ? 'emerald' : 'red'}
        />
        <KpiTile
          label="YTD Income"
          value={formatUSD(kpis.ytdIncome)}
          caption="Income + Refunds"
          captionTone="neutral"
          icon={TrendingUp}
          iconTone="emerald"
        />
        <KpiTile
          label="YTD Expenses"
          value={formatUSD(kpis.ytdExpense)}
          caption={`Avg ${formatUSD(kpis.avgMonthlyExpense)} / month`}
          captionTone="neutral"
          icon={TrendingDown}
          iconTone="red"
        />
        <KpiTile
          label="YTD Net"
          value={formatUSD(kpis.ytdNet)}
          caption={`${formatPct(kpis.savingsRate)} savings rate`}
          captionTone={savingsTone}
          icon={kpis.ytdNet >= 0 ? PiggyBank : Coins}
          iconTone={kpis.ytdNet >= 0 ? 'purple' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          label="Total Debt"
          value={formatUSD(kpis.totalDebt)}
          caption={`${kpis.debtToIncomeRatio === 0 ? '—' : formatPct(kpis.debtToIncomeRatio)} debt-to-income`}
          captionTone={dtiTone}
          icon={Receipt}
          iconTone={kpis.totalDebt > 0 ? 'red' : 'gray'}
        />
        <KpiTile
          label="Cash Runway"
          value={formatMonths(kpis.cashRunwayMonths)}
          caption="At current spending pace"
          captionTone={kpis.cashRunwayMonths >= 6 ? 'positive' : kpis.cashRunwayMonths >= 3 ? 'neutral' : 'negative'}
          icon={Calendar}
          iconTone="blue"
        />
        <KpiTile
          label="Cash on Hand"
          value={formatUSD(summary.totalCash)}
          caption="Liquid checking + savings"
          captionTone="neutral"
          icon={Wallet}
          iconTone="blue"
        />
        <KpiTile
          label="Investments"
          value={formatUSD(summary.totalInvestments)}
          caption="Brokerage + retirement"
          captionTone="neutral"
          icon={TrendingUp}
          iconTone="purple"
        />
      </div>
    </div>
  )
}
