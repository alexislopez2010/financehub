'use client'

import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Target,
  Calendar,
  type LucideIcon
} from 'lucide-react'
import {
  FIXTURE_KPIS,
  FIXTURE_COMING_DUE,
  FIXTURE_FORECAST_POINTS,
  FIXTURE_NOTABLE,
  FIXTURE_LEAD,
  FIXTURE_TODAY_LABEL
} from './fixtures'
import { Sparkline } from '@/components/charts/Sparkline'

interface KpiTileProps {
  label: string
  value: string
  caption?: string
  captionTone?: 'positive' | 'negative' | 'neutral'
  icon: LucideIcon
  iconTone: 'emerald' | 'red' | 'purple' | 'blue'
}

const iconToneClasses: Record<KpiTileProps['iconTone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  blue: 'bg-blue-50 text-blue-600'
}

const captionToneClasses: Record<NonNullable<KpiTileProps['captionTone']>, string> = {
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  neutral: 'text-gray-500'
}

function KpiTile({
  label,
  value,
  caption,
  captionTone = 'neutral',
  icon: Icon,
  iconTone
}: KpiTileProps) {
  const arrow =
    captionTone === 'positive' ? '↗' : captionTone === 'negative' ? '↘' : ''
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-gray-500">
          {label}
        </div>
        <div
          className={`flex items-center justify-center w-9 h-9 rounded-lg ${iconToneClasses[iconTone]}`}
        >
          <Icon size={18} strokeWidth={2} />
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight">{value}</div>
      {caption && (
        <div className={`text-xs ${captionToneClasses[captionTone]}`}>
          {arrow && <span className="mr-1">{arrow}</span>}
          {caption}
        </div>
      )}
    </div>
  )
}

function formatUSD(n: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && Math.abs(n) >= 1000) {
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    })
  }
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatParens(n: number): string {
  return n < 0
    ? `(${formatUSD(Math.abs(n), { compact: true })})`
    : formatUSD(n, { compact: true })
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function BriefingDashboard() {
  const k = FIXTURE_KPIS
  const dueTotal = FIXTURE_COMING_DUE.reduce((s, x) => s + x.amount, 0)
  const forecastEnd =
    FIXTURE_FORECAST_POINTS[FIXTURE_FORECAST_POINTS.length - 1] ?? k.cash

  // Suppress "unused" lint — FIXTURE_LEAD is imported for reference parity
  void FIXTURE_LEAD

  return (
    <div className="space-y-6 bg-gray-50 p-6 rounded-2xl">
      {/* Top bar with date + period mock */}
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Lopez Family · Briefing</h2>
          <div className="text-xs text-gray-500 mt-0.5">{FIXTURE_TODAY_LABEL}</div>
        </div>
        <div className="text-xs text-gray-500">YTD · all accounts</div>
      </header>

      {/* Top KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Income"
          value={formatUSD(k.income, { compact: true })}
          caption="97.6% vs prev month"
          captionTone="negative"
          icon={TrendingUp}
          iconTone="emerald"
        />
        <KpiTile
          label="Expenses"
          value={formatUSD(k.expenses, { compact: true })}
          caption="75.9% vs prev month"
          captionTone="positive"
          icon={TrendingDown}
          iconTone="red"
        />
        <KpiTile
          label="Net Cash Flow"
          value={formatParens(k.netCashFlow)}
          caption="Deficit"
          captionTone="neutral"
          icon={DollarSign}
          iconTone="red"
        />
        <KpiTile
          label="Savings Rate"
          value={formatPct(k.savingsRate)}
          caption="Below 20% target"
          captionTone="neutral"
          icon={Wallet}
          iconTone="purple"
        />
      </div>

      {/* Bottom KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile
          label="Planned Income"
          value={formatUSD(k.plannedIncome, { compact: true })}
          caption="100% received"
          captionTone="neutral"
          icon={TrendingUp}
          iconTone="emerald"
        />
        <KpiTile
          label="Projected Net"
          value={formatUSD(k.projectedNet, { compact: true })}
          caption="Planned income − budgeted expenses"
          captionTone="neutral"
          icon={DollarSign}
          iconTone="emerald"
        />
        <KpiTile
          label="Target Savings"
          value={formatPct(k.targetSavings)}
          caption={`Actual: ${formatPct(k.savingsRate)}`}
          captionTone="neutral"
          icon={Target}
          iconTone="purple"
        />
        <KpiTile
          label="Income Variance"
          value={formatParens(k.incomeVariance)}
          caption="Behind plan"
          captionTone="negative"
          icon={TrendingUp}
          iconTone="red"
        />
      </div>

      {/* Coming Due + Forecast row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
                <Calendar size={16} strokeWidth={2} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">Coming Due — 14 days</h3>
            </div>
            <span className="text-xs text-gray-500">{formatUSD(dueTotal)} total</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {FIXTURE_COMING_DUE.map(item => (
              <li key={item.billId} className="flex justify-between py-2 text-sm">
                <span>
                  <span className="text-gray-500 text-xs mr-2 tabular-nums">
                    +{item.daysUntil}d
                  </span>
                  {item.name}
                </span>
                <span className="tabular-nums font-semibold text-gray-900">
                  {formatUSD(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">30-Day Forecast</h3>
            <span className="text-xs text-gray-500">
              ends {formatUSD(forecastEnd, { compact: true })}
            </span>
          </div>
          <Sparkline
            points={FIXTURE_FORECAST_POINTS}
            baseline={k.cash}
            label="Projected cash balance over the next 30 days"
            className="h-24"
          />
        </section>
      </div>

      {/* Notable row */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Notable</h3>
        <div className="space-y-3">
          {FIXTURE_NOTABLE.map((c, i) => (
            <p key={i} className="text-sm leading-relaxed">
              <strong className="text-gray-900">{c.lead}</strong>{' '}
              <span className="text-gray-600">{c.body}</span>
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}
