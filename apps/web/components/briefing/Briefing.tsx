'use client'

import { useMemo } from 'react'
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Coins,
  Calendar,
  PiggyBank,
  Flame
} from 'lucide-react'
import { useAccounts } from '@/lib/data/accounts'
import { useBills } from '@/lib/data/bills'
import { useTransactions } from '@/lib/data/transactions'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { useBudgets } from '@/lib/data/budgets'
import { KpiTile } from '@/components/ui/KpiTile'
import { RulerList, type RulerListItem } from '@/components/ui/RulerList'
import { Sparkline } from '@/components/charts/Sparkline'
import { deriveKpisAndExtras } from '@/lib/briefing/kpis'
import { comingDueWithin } from '@/lib/briefing/comingDue'
import { notableCallouts } from '@/lib/briefing/notable'
import { buildLead } from '@/lib/briefing/headline'
import { deriveSpendByCategory } from '@/lib/briefing/spendByCategory'
import { deriveBudgetSnapshot } from '@/lib/briefing/budgetSnapshot'
import { deriveTopMerchants } from '@/lib/briefing/topMerchants'
import { SpendByCategoryCard } from '@/components/briefing/SpendByCategoryCard'
import { BudgetSnapshotCard } from '@/components/briefing/BudgetSnapshotCard'
import { IncomeVsExpenseCard } from '@/components/briefing/IncomeVsExpenseCard'
import { TopMerchantsCard } from '@/components/briefing/TopMerchantsCard'
import { forecast30Day } from '@/lib/finance/forecast'
import type {
  TransactionRow as FinanceTransactionRow,
  BillRow as FinanceBillRow,
  IncomePlanRow as FinanceIncomePlanRow
} from '@/lib/finance/types'

export function Briefing() {
  const today = useMemo(() => {
    const d = new Date()
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate()
    }
  }, [])

  const todayIso = useMemo(
    () =>
      `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    [today]
  )

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
    []
  )

  const periodLabel = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) + ' · all accounts'
  }, [])

  const monthLabel = useMemo(
    () =>
      new Date(today.year, today.month - 1, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric'
      }),
    [today]
  )

  // Pull data
  const accountsQ = useAccounts()
  const billsQ = useBills()
  const txsQ = useTransactions()
  const incomeQ = useIncomePlan({ year: today.year })
  const budgetsQ = useBudgets({ year: today.year, month: today.month })

  const EMPTY_ACCOUNTS = useMemo(() => [] as const, [])
  const EMPTY_BILLS = useMemo(() => [] as const, [])
  const EMPTY_TXS = useMemo(() => [] as const, [])
  const EMPTY_INCOME = useMemo(() => [] as const, [])
  const EMPTY_BUDGETS = useMemo(() => [] as const, [])

  const accounts = accountsQ.data ?? EMPTY_ACCOUNTS
  const bills = billsQ.data ?? EMPTY_BILLS
  const txs = txsQ.data ?? EMPTY_TXS
  const incomePlan = incomeQ.data ?? EMPTY_INCOME
  const budgets = budgetsQ.data ?? EMPTY_BUDGETS

  // Derive
  const { kpis, extras } = useMemo(
    () =>
      deriveKpisAndExtras({
        accounts,
        transactions: txs,
        today: { year: today.year, month: today.month, day: today.day }
      }),
    [accounts, txs, today]
  )

  const coming = useMemo(
    () => comingDueWithin(bills, today, 14),
    [bills, today]
  )

  const notable = useMemo(
    () => notableCallouts({ transactions: txs, bills, today, top: 3 }),
    [txs, bills, today]
  )

  const categorySpend = useMemo(
    () =>
      deriveSpendByCategory({
        transactions: txs,
        today: { year: today.year, month: today.month },
        top: 7
      }),
    [txs, today]
  )

  const budgetSnap = useMemo(
    () =>
      deriveBudgetSnapshot({
        budgets,
        transactions: txs,
        today: { year: today.year, month: today.month }
      }),
    [budgets, txs, today]
  )

  const merchantSpend = useMemo(
    () =>
      deriveTopMerchants({
        transactions: txs,
        today: { year: today.year, month: today.month },
        top: 5
      }),
    [txs, today]
  )

  // Suppress unused — lead is computed so buildLead stays exercised with real data
  const _lead = useMemo(() => buildLead({ kpis }), [kpis])
  void _lead

  const financeTxs = txs as unknown as ReadonlyArray<FinanceTransactionRow>

  const financeIncomePlan = useMemo(
    (): ReadonlyArray<FinanceIncomePlanRow> =>
      incomePlan.map(p => ({
        id: p.id,
        household_id: p.household_id,
        source: p.source ?? null,
        member: p.member ?? null,
        year: p.year,
        month: p.month,
        expected_amount: p.expected_amount,
        is_active: p.is_active,
        cadence: (p.frequency as FinanceIncomePlanRow['cadence']) ?? null
      })),
    [incomePlan]
  )

  const financeBills = bills as unknown as ReadonlyArray<FinanceBillRow>

  const forecast = useMemo(
    () =>
      forecast30Day(financeTxs, financeBills, financeIncomePlan, {
        startBalance: kpis.cash,
        startDate: todayIso,
        days: 30
      }),
    [financeTxs, financeBills, financeIncomePlan, kpis.cash, todayIso]
  )

  const forecastPoints = useMemo(() => forecast.map(p => p.balance), [forecast])

  const anyError =
    accountsQ.error ?? billsQ.error ?? txsQ.error ?? incomeQ.error ?? budgetsQ.error
  const allLoading =
    accountsQ.isLoading &&
    billsQ.isLoading &&
    txsQ.isLoading &&
    incomeQ.isLoading &&
    budgetsQ.isLoading

  if (anyError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
      >
        <strong className="font-semibold">Couldn&apos;t load Briefing data.</strong>{' '}
        {anyError instanceof Error ? anyError.message : String(anyError)}
      </div>
    )
  }

  if (allLoading) {
    return <BriefingSkeleton />
  }

  // Coming due as RulerList items
  const dueItems: ReadonlyArray<RulerListItem> = coming.map(item => ({
    key: item.billId,
    label: (
      <span>
        <span className="text-muted tabular-nums mr-2 text-[11px]">
          {item.daysUntil === 0 ? 'TODAY' : `+${item.daysUntil}d`}
        </span>
        {item.name}
      </span>
    ),
    value: formatUSD(item.amount)
  }))

  const dueTotal = coming.reduce((s, x) => s + x.amount, 0)
  const forecastEnd = forecast.at(-1)?.balance ?? kpis.cash
  const isEmpty = txs.length === 0 && bills.length === 0 && accounts.length === 0

  const netWorth = kpis.cash - kpis.debt
  const thisMonthPositive = kpis.thisMonthNet >= 0

  const savingsRatePct = Math.round(kpis.savingsRate * 100)
  const savingsRateCaption =
    kpis.savingsRate >= 0.2
      ? 'on target'
      : kpis.savingsRate >= 0.1
        ? 'below target'
        : 'aggressive'
  const savingsRateTone: 'positive' | 'neutral' | 'negative' =
    kpis.savingsRate >= 0.2
      ? 'positive'
      : kpis.savingsRate >= 0.1
        ? 'neutral'
        : 'negative'

  const burnRateRounded = Math.round(kpis.burnRate30Day).toLocaleString('en-US')
  const runwayCaption = `${kpis.monthsOfRunway.toFixed(1)}mo runway`
  const runwayTone: 'positive' | 'neutral' | 'negative' =
    kpis.monthsOfRunway >= 6
      ? 'positive'
      : kpis.monthsOfRunway >= 3
        ? 'neutral'
        : 'negative'

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-ink">Lopez Family · Briefing</h1>
          <div className="text-xs text-muted mt-0.5">{todayLabel}</div>
        </div>
        <div className="text-xs text-muted">{periodLabel}</div>
      </header>

      {/* KPI tiles (6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiTile
          label="Cash"
          value={formatUSDCompact(kpis.cash)}
          icon={Wallet}
          iconTone="emerald"
        />
        <KpiTile
          label="Debt"
          value={formatUSDCompact(kpis.debt)}
          icon={CreditCard}
          iconTone="red"
        />
        <KpiTile
          label="This Month"
          value={
            (kpis.thisMonthNet >= 0 ? '+' : '−') +
            formatUSDCompact(Math.abs(kpis.thisMonthNet))
          }
          caption={thisMonthPositive ? 'net positive' : kpis.thisMonthNet < 0 ? 'net negative' : 'flat'}
          captionTone={thisMonthPositive ? 'positive' : kpis.thisMonthNet < 0 ? 'negative' : 'neutral'}
          icon={thisMonthPositive ? TrendingUp : TrendingDown}
          iconTone={thisMonthPositive ? 'emerald' : 'red'}
        />
        <KpiTile
          label="Net Worth"
          value={formatUSDCompact(netWorth)}
          caption={netWorth >= 0 ? 'positive position' : 'negative position'}
          captionTone={netWorth >= 0 ? 'positive' : 'negative'}
          icon={Coins}
          iconTone="purple"
        />
        <KpiTile
          label="Savings Rate"
          value={`${savingsRatePct}%`}
          caption={savingsRateCaption}
          captionTone={savingsRateTone}
          icon={PiggyBank}
          iconTone="emerald"
        />
        <KpiTile
          label="Burn Rate"
          value={`$${burnRateRounded}/d`}
          caption={runwayCaption}
          captionTone={runwayTone}
          icon={Flame}
          iconTone="red"
        />
      </div>

      {/* Row 1: where money went */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SpendByCategoryCard rows={categorySpend} />
        <TopMerchantsCard rows={merchantSpend} />
      </div>

      {/* Row 2: this-month big picture */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BudgetSnapshotCard snapshot={budgetSnap} monthLabel={monthLabel} />
        <IncomeVsExpenseCard
          monthIncome={extras.monthIncome}
          monthExpense={extras.monthExpense}
        />
      </div>

      {/* Row 3: forward-looking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-surface border border-rule rounded-xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
                <Calendar size={16} strokeWidth={2} />
              </div>
              <h2 className="text-sm font-semibold text-ink">Coming Due — 14 days</h2>
            </div>
            {coming.length > 0 && (
              <span className="text-xs text-muted">{formatUSD(dueTotal)} total</span>
            )}
          </div>
          {coming.length === 0 ? (
            <p className="text-sm text-muted italic">Nothing scheduled in the next 14 days.</p>
          ) : (
            <RulerList items={dueItems} />
          )}
        </section>

        <section className="bg-surface border border-rule rounded-xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">30-Day Forecast</h2>
            <span className="text-xs text-muted">
              ends {formatUSDCompact(forecastEnd)}
            </span>
          </div>
          <Sparkline
            points={forecastPoints}
            baseline={kpis.cash}
            label="Projected cash balance over the next 30 days"
            className="h-24"
          />
        </section>
      </div>

      {/* Notable callouts */}
      <section className="bg-surface border border-rule rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-ink mb-3">Notable</h2>
        {notable.length === 0 ? (
          <p className="text-sm text-muted italic">Nothing notable this period.</p>
        ) : (
          <div className="space-y-3">
            {notable.map((c, i) => (
              <p key={i} className="text-sm leading-relaxed">
                <strong className="text-ink">{c.lead}</strong>{' '}
                <span className="text-muted">{c.body}</span>
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Empty state */}
      {isEmpty && (
        <div className="rounded-xl border border-rule bg-surface p-5 text-sm text-muted text-center">
          No data yet. Add an account in{' '}
          <a href="/accounts" className="underline text-brand">
            Accounts
          </a>{' '}
          or start tracking in the{' '}
          <a href="/ledger" className="underline text-brand">
            Ledger
          </a>
          .
        </div>
      )}
    </div>
  )
}

function BriefingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-48 rounded bg-gray-200" />
          <div className="h-3 w-28 rounded bg-gray-200" />
        </div>
        <div className="h-3 w-32 rounded bg-gray-200" />
      </div>

      {/* KPI tiles skeleton (6) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {([0, 1, 2, 3, 4, 5] as const).map(i => (
          <div key={i} className="bg-surface border border-rule rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div className="h-2.5 w-16 rounded bg-gray-200" />
              <div className="w-9 h-9 rounded-lg bg-gray-200" />
            </div>
            <div className="h-8 w-24 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Cards rows skeleton (3 rows of 2) */}
      {([0, 1, 2] as const).map(row => (
        <div key={row} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([0, 1] as const).map(i => (
            <div
              key={i}
              className="bg-surface border border-rule rounded-xl p-5 shadow-sm space-y-3"
            >
              <div className="h-4 w-36 rounded bg-gray-200" />
              <div className="h-5 w-full rounded bg-gray-200" />
              <div className="h-5 w-full rounded bg-gray-200" />
              <div className="h-5 w-4/5 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ))}

      {/* Notable skeleton */}
      <div className="bg-surface border border-rule rounded-xl p-5 shadow-sm space-y-3">
        <div className="h-4 w-20 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-5/6 rounded bg-gray-200" />
      </div>
    </div>
  )
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatUSDCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
