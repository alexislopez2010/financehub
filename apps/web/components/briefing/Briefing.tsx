'use client'

import { useMemo } from 'react'
import { useAccounts } from '@/lib/data/accounts'
import { useBills } from '@/lib/data/bills'
import { useTransactions } from '@/lib/data/transactions'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { Masthead } from '@/components/ui/Masthead'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { KpiStone } from '@/components/ui/KpiStone'
import { RulerList, type RulerListItem } from '@/components/ui/RulerList'
import { Sparkline } from '@/components/charts/Sparkline'
import { deriveKpis } from '@/lib/briefing/kpis'
import { comingDueWithin } from '@/lib/briefing/comingDue'
import { notableCallouts } from '@/lib/briefing/notable'
import { buildLead } from '@/lib/briefing/headline'
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
        day: 'numeric'
      }).toUpperCase(),
    []
  )

  // Pull data
  const accountsQ = useAccounts()
  const billsQ = useBills()
  const txsQ = useTransactions()
  const incomeQ = useIncomePlan({ year: today.year })

  const EMPTY_ACCOUNTS = useMemo(() => [] as const, [])
  const EMPTY_BILLS = useMemo(() => [] as const, [])
  const EMPTY_TXS = useMemo(() => [] as const, [])
  const EMPTY_INCOME = useMemo(() => [] as const, [])

  const accounts = accountsQ.data ?? EMPTY_ACCOUNTS
  const bills = billsQ.data ?? EMPTY_BILLS
  const txs = txsQ.data ?? EMPTY_TXS
  const incomePlan = incomeQ.data ?? EMPTY_INCOME

  // Derive
  const kpis = useMemo(
    () => deriveKpis({ accounts, transactions: txs, today: { year: today.year, month: today.month } }),
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

  const lead = useMemo(() => buildLead({ kpis }), [kpis])

  // The finance pure modules use hand-typed TransactionRow / IncomePlanRow that
  // differ slightly from the Supabase-generated types (narrower union vs. string).
  // These casts are safe: the data shape is identical at runtime.
  const financeTxs = txs as unknown as ReadonlyArray<FinanceTransactionRow>

  // Map Supabase income_plan rows → finance IncomePlanRow (frequency → cadence).
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

  const anyError = accountsQ.error ?? billsQ.error ?? txsQ.error ?? incomeQ.error
  const allLoading = accountsQ.isLoading && billsQ.isLoading && txsQ.isLoading && incomeQ.isLoading

  if (anyError) {
    return (
      <article className="space-y-8">
        <Masthead volume="VOL. III · BRIEFING" date={todayLabel} />
        <div
          role="alert"
          className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-3 text-sm text-warn"
        >
          Couldn&apos;t load Briefing data.{' '}
          {anyError instanceof Error ? anyError.message : String(anyError)}
        </div>
      </article>
    )
  }

  if (allLoading) {
    return <BriefingSkeleton todayLabel={todayLabel} />
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

  return (
    <article className="space-y-10">
      <Masthead volume="VOL. III · BRIEFING" date={todayLabel} />

      {/* Lead */}
      <div className="space-y-3">
        <SectionLabel>The Headline</SectionLabel>
        <Headline>{lead.headline}</Headline>
        <Standfirst>{lead.standfirst}</Standfirst>
      </div>

      {/* KPI stones */}
      <div className="grid grid-cols-3 gap-4 border-t border-b border-rule py-4">
        <KpiStone label="Cash" value={formatUSDCompact(kpis.cash)} />
        <KpiStone label="Debt" value={formatUSDCompact(kpis.debt)} />
        <KpiStone
          label="This Month"
          value={
            (kpis.thisMonthNet >= 0 ? '+' : '−') +
            formatUSDCompact(Math.abs(kpis.thisMonthNet))
          }
          caption={
            kpis.thisMonthNet > 0
              ? 'net positive'
              : kpis.thisMonthNet < 0
                ? 'net negative'
                : 'flat'
          }
          tone={
            kpis.thisMonthNet > 0
              ? 'positive'
              : kpis.thisMonthNet < 0
                ? 'negative'
                : 'neutral'
          }
        />
      </div>

      {/* Coming Due */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Coming Due — 14 days</SectionLabel>
          {coming.length > 0 && (
            <span className="text-[11px] italic text-muted">{formatUSD(dueTotal)} total</span>
          )}
        </div>
        {coming.length === 0 ? (
          <p className="text-sm text-muted italic">
            Nothing scheduled in the next 14 days.
          </p>
        ) : (
          <RulerList items={dueItems} />
        )}
      </section>

      {/* 30-day forecast */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>30-Day Forecast</SectionLabel>
          <span className="text-[11px] italic text-muted">
            ends {formatUSD(forecastEnd)}
          </span>
        </div>
        <Sparkline
          points={forecastPoints}
          baseline={kpis.cash}
          label="Projected cash balance over the next 30 days"
        />
      </section>

      {/* Notable callouts */}
      <section className="space-y-3 border-t border-rule pt-6">
        <SectionLabel>Notable</SectionLabel>
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

      {/* Empty state — no data at all */}
      {isEmpty && (
        <div className="rounded-xl border border-rule bg-surface p-5 text-sm text-muted text-center">
          No data yet. Add an account in{' '}
          <a href="/accounts" className="underline">
            Accounts
          </a>{' '}
          or start tracking in the{' '}
          <a href="/ledger" className="underline">
            Ledger
          </a>
          .
        </div>
      )}
    </article>
  )
}

function BriefingSkeleton({ todayLabel }: { todayLabel: string }) {
  return (
    <article className="space-y-10 animate-pulse">
      <Masthead volume="VOL. III · BRIEFING" date={todayLabel} />

      {/* Lead skeleton */}
      <div className="space-y-3 pt-2">
        <div className="h-3 w-24 rounded bg-rule" />
        <div className="h-8 w-3/4 rounded bg-rule" />
        <div className="h-4 w-full rounded bg-rule" />
        <div className="h-4 w-5/6 rounded bg-rule" />
      </div>

      {/* KPI stones skeleton */}
      <div className="grid grid-cols-3 gap-4 border-t border-b border-rule py-4">
        {([0, 1, 2] as const).map(i => (
          <div key={i} className="space-y-2">
            <div className="h-2.5 w-10 rounded bg-rule" />
            <div className="h-5 w-16 rounded bg-rule" />
          </div>
        ))}
      </div>

      {/* Coming due skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-32 rounded bg-rule" />
        <div className="h-6 w-full rounded bg-rule" />
        <div className="h-6 w-full rounded bg-rule" />
        <div className="h-6 w-4/5 rounded bg-rule" />
      </div>

      {/* Sparkline skeleton */}
      <div className="h-20 w-full rounded bg-rule" />
    </article>
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
