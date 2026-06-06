'use client'

import { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, PiggyBank, Scale, Coins, Receipt, Calendar, Wallet } from 'lucide-react'
import { useAccounts } from '@/lib/data/accounts'
import { useTransactions } from '@/lib/data/transactions'
import { useDebts } from '@/lib/data/debts'
import { deriveBalances } from '@/lib/accounts/balances'
import { deriveCfoKpis } from '@/lib/accounts/cfo'
import { mergeDebtsWithAccounts } from '@/lib/finance/debtAccountMerge'
import { KpiTile } from '@/components/ui/KpiTile'
import { CfoKpiDrawer, type CfoKpiKind } from './CfoKpiDrawer'
import { FiftyThirtyTwentySection } from './FiftyThirtyTwentySection'

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

  /** Which tile is currently drilled. Same pattern as the Briefing. */
  const [expandedKpi, setExpandedKpi] = useState<CfoKpiKind | null>(null)
  function toggleKpi(kind: CfoKpiKind) {
    setExpandedKpi(prev => (prev === kind ? null : kind))
  }

  const summary = useMemo(() => deriveBalances({
    accounts: accountsQ.data ?? [],
    transactions: txsQ.data ?? []
  }), [accountsQ.data, txsQ.data])

  // Overlay the live account balance onto each debt row so the CFO Total Debt
  // tile shows the truth from accounts. mergeDebtsWithAccounts returns the
  // resolved balance per debt id; we splat that onto the raw debt rows to
  // preserve the rest of the DebtRow shape (and the deriveCfoKpis signature).
  const debtsForCfo = useMemo(() => {
    const raw = debtsQ.data ?? []
    const merged = mergeDebtsWithAccounts({ debts: raw, summary })
    const balanceById = new Map(merged.map(m => [m.id, m.balance]))
    return raw.map(d => ({ ...d, balance: balanceById.get(d.id) ?? d.balance }))
  }, [debtsQ.data, summary])

  const kpis = useMemo(() => deriveCfoKpis({
    summary,
    transactions: txsQ.data ?? [],
    debts: debtsForCfo,
    today
  }), [summary, txsQ.data, debtsForCfo, today])

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

  // Compact labels + values used in the drawer header so the user can see
  // which tile they're looking at after scrolling.
  const drawerHeaderLabel: Record<CfoKpiKind, string> = {
    'net-worth':    'Net Worth',
    'ytd-income':   'YTD Income',
    'ytd-expense':  'YTD Expense',
    'ytd-net':      'YTD Net',
    'total-debt':   'Total Debt',
    'cash-runway':  'Cash Runway',
    'cash-on-hand': 'Cash on Hand',
    'investments':  'Investments'
  }
  const drawerHeaderValue: Record<CfoKpiKind, string> = {
    'net-worth':    formatUSD(kpis.netWorth),
    'ytd-income':   formatUSD(kpis.ytdIncome),
    'ytd-expense':  formatUSD(kpis.ytdExpense),
    'ytd-net':      formatUSD(kpis.ytdNet),
    'total-debt':   formatUSD(kpis.totalDebt),
    'cash-runway':  formatMonths(kpis.cashRunwayMonths),
    'cash-on-hand': formatUSD(summary.totalCash),
    'investments':  formatUSD(summary.totalInvestments)
  }

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
          onClick={() => toggleKpi('net-worth')}
          active={expandedKpi === 'net-worth'}
        />
        <KpiTile
          label="YTD Income"
          value={formatUSD(kpis.ytdIncome)}
          caption="Income + Refunds"
          captionTone="neutral"
          icon={TrendingUp}
          iconTone="emerald"
          onClick={() => toggleKpi('ytd-income')}
          active={expandedKpi === 'ytd-income'}
        />
        <KpiTile
          label="YTD Expenses"
          value={formatUSD(kpis.ytdExpense)}
          caption={`Avg ${formatUSD(kpis.avgMonthlyExpense)} / month`}
          captionTone="neutral"
          icon={TrendingDown}
          iconTone="red"
          onClick={() => toggleKpi('ytd-expense')}
          active={expandedKpi === 'ytd-expense'}
        />
        <KpiTile
          label="YTD Net"
          value={formatUSD(kpis.ytdNet)}
          caption={`${formatPct(kpis.savingsRate)} savings rate`}
          captionTone={savingsTone}
          icon={kpis.ytdNet >= 0 ? PiggyBank : Coins}
          iconTone={kpis.ytdNet >= 0 ? 'purple' : 'red'}
          onClick={() => toggleKpi('ytd-net')}
          active={expandedKpi === 'ytd-net'}
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
          onClick={() => toggleKpi('total-debt')}
          active={expandedKpi === 'total-debt'}
        />
        <KpiTile
          label="Cash Runway"
          value={formatMonths(kpis.cashRunwayMonths)}
          caption="At current spending pace"
          captionTone={kpis.cashRunwayMonths >= 6 ? 'positive' : kpis.cashRunwayMonths >= 3 ? 'neutral' : 'negative'}
          icon={Calendar}
          iconTone="blue"
          onClick={() => toggleKpi('cash-runway')}
          active={expandedKpi === 'cash-runway'}
        />
        <KpiTile
          label="Cash on Hand"
          value={formatUSD(summary.totalCash)}
          caption="Liquid checking + savings"
          captionTone="neutral"
          icon={Wallet}
          iconTone="blue"
          onClick={() => toggleKpi('cash-on-hand')}
          active={expandedKpi === 'cash-on-hand'}
        />
        <KpiTile
          label="Investments"
          value={formatUSD(summary.totalInvestments)}
          caption="Brokerage + retirement"
          captionTone="neutral"
          icon={TrendingUp}
          iconTone="purple"
          onClick={() => toggleKpi('investments')}
          active={expandedKpi === 'investments'}
        />
      </div>

      {expandedKpi && (
        <CfoKpiDrawer
          kind={expandedKpi}
          onClose={() => setExpandedKpi(null)}
          summary={summary}
          kpis={kpis}
          transactions={txsQ.data ?? []}
          debts={debtsForCfo}
          year={today.year}
          monthsElapsed={today.month}
          headerLabel={drawerHeaderLabel[expandedKpi]}
          headerValue={drawerHeaderValue[expandedKpi]}
        />
      )}

      <FiftyThirtyTwentySection />
    </div>
  )
}
