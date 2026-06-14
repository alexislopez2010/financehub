'use client'

import { useMemo } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useTransactions } from '@/lib/data/transactions'
import { useCategories } from '@/lib/data/categories'
import { useIncomePlan } from '@/lib/data/incomePlan'
import { deriveFiftyThirtyTwenty, type BucketRow } from '@/lib/accounts/fiftyThirtyTwenty'
import { cn } from '@/lib/cn'

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatPct(decimal: number, digits = 0): string {
  return `${(decimal * 100).toFixed(digits)}%`
}

function formatVariance(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  return n >= 0 ? `+${abs}` : `−${abs}`
}

interface BucketRowKind {
  label: string
  color: string
  bgColor: string
  bg: string
  /** When true, "under" (positive variance) is GOOD; when false, "over" is GOOD (savings). */
  underIsGood: boolean
}

const BUCKETS: ReadonlyArray<BucketRowKind & { key: 'needs' | 'wants' | 'savings'; description: string }> = [
  {
    key: 'needs',
    label: 'Needs',
    color: 'text-blue-700',
    bgColor: 'bg-blue-500',
    bg: 'bg-blue-50',
    underIsGood: true,
    description: 'Essentials: housing, utilities, groceries, transportation, insurance, minimum debt payments.'
  },
  {
    key: 'wants',
    label: 'Wants',
    color: 'text-amber-700',
    bgColor: 'bg-amber-500',
    bg: 'bg-amber-50',
    underIsGood: true,
    description: 'Discretionary: dining, entertainment, shopping, hobbies, subscriptions.'
  },
  {
    key: 'savings',
    label: 'Savings',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-500',
    bg: 'bg-emerald-50',
    underIsGood: false,
    description: 'What’s left after Needs and Wants. Includes money moving to savings, investments, and extra debt principal.'
  }
] as const

export function FiftyThirtyTwentySection() {
  const txsQ = useTransactions()
  const categoriesQ = useCategories()

  const today = useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }, [])

  const incomePlanQ = useIncomePlan({ year: today.year })

  // Sum income_plan rows for the CURRENT month → monthly take-home target.
  // The hook fetches the whole year; we filter to this month in-component.
  const monthlyIncome = useMemo(() => {
    const rows = incomePlanQ.data ?? []
    return rows
      .filter(r => r.is_active && r.month === today.month)
      .reduce((s, r) => s + (r.expected_amount ?? 0), 0)
  }, [incomePlanQ.data, today.month])

  const result = useMemo(() => deriveFiftyThirtyTwenty({
    monthlyIncome,
    transactions: txsQ.data ?? [],
    categories: categoriesQ.data ?? [],
    year: today.year,
    monthsElapsed: today.month
  }), [monthlyIncome, txsQ.data, categoriesQ.data, today.year, today.month])

  const isLoading = txsQ.isLoading || categoriesQ.isLoading || incomePlanQ.isLoading
  const error = txsQ.error || categoriesQ.error || incomePlanQ.error

  if (isLoading) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-6 shadow-sm text-center text-sm text-muted">
        Loading 50/30/20 view…
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-sm text-red-700">
        Failed to load 50/30/20 view: {error.message}
      </div>
    )
  }

  // No income configured for this month — render a soft empty state instead of zeros everywhere.
  if (monthlyIncome === 0) {
    return (
      <section
        aria-label="50/30/20 budget framework"
        className="bg-surface border border-rule rounded-xl shadow-sm p-5 space-y-3"
      >
        <SectionHeader />
        <div className="text-sm text-muted">
          No planned income found for {monthName(today.month)} {today.year}. Add income on the Plan
          surface to see the 50/30/20 target vs actual comparison.
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="50/30/20 budget framework"
      className="bg-surface border border-rule rounded-xl shadow-sm p-5 space-y-4"
    >
      <SectionHeader />

      <div className="text-xs text-muted">
        Based on <span className="font-semibold text-ink">{formatUSD(monthlyIncome)}</span> budgeted
        income for {monthName(today.month)} {today.year}.
        Actuals are YTD spend averaged over {today.month} {today.month === 1 ? 'month' : 'months'}.
      </div>

      {/* Comparison table — scroll horizontally on narrow phones so the 4
          currency/percent columns don't crush the Bucket description column. */}
      <div className="overflow-x-auto rounded-lg border border-rule">
        <table className="w-full min-w-[440px] text-sm">
          <thead className="bg-bg/60 text-[11px] uppercase tracking-[0.10em] text-muted">
            <tr>
              <th className="text-left  px-3 py-2 font-medium">Bucket</th>
              <th className="text-right px-3 py-2 font-medium">Target</th>
              <th className="text-right px-3 py-2 font-medium">Actual</th>
              <th className="text-right px-3 py-2 font-medium">Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {BUCKETS.map(b => {
              const row: BucketRow = result[b.key]
              const isGoodVariance = b.underIsGood ? row.variance >= 0 : row.variance <= 0
              return (
                <tr key={b.key} className="bg-surface">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('inline-block w-2.5 h-2.5 rounded-full', b.bgColor)} aria-hidden="true" />
                      <span className={cn('font-medium', b.color)}>{b.label}</span>
                    </div>
                    <div className="text-[11px] text-muted ml-4.5 pl-2 mt-0.5">{b.description}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    <div>{formatUSD(row.target)}</div>
                    <div className="text-[11px] text-muted">{formatPct(row.targetPct)}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular">
                    <div>{formatUSD(row.actual)}</div>
                    <div className="text-[11px] text-muted">{formatPct(row.actualPct, 1)}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className={cn('inline-flex items-center gap-1 tabular',
                      isGoodVariance ? 'text-emerald-700' : 'text-red-700'
                    )}>
                      {isGoodVariance
                        ? <CheckCircle2 size={12} aria-hidden="true" />
                        : <AlertCircle  size={12} aria-hidden="true" />
                      }
                      {formatVariance(row.variance)}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actual-distribution stacked bar */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.10em] font-semibold text-muted">
          Actual distribution
        </div>
        <StackedBar result={result} />
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Target: 50% / 30% / 20%</span>
          <span>
            Actual: {formatPct(result.needs.actualPct, 0)} / {formatPct(result.wants.actualPct, 0)} / {formatPct(Math.max(0, result.savings.actualPct), 0)}
          </span>
        </div>
      </div>

      {result.unclassifiedYtdExpense > 0 && (
        <p className="text-[11px] text-muted">
          Note: {formatUSD(result.unclassifiedYtdExpense)} of YTD expense rows have no Needs/Wants
          classification. Set is_fixed on their categories (Admin → Categories) to count them.
        </p>
      )}
    </section>
  )
}

function SectionHeader() {
  return (
    <header>
      <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
        Framework
      </div>
      <div className="text-sm font-semibold text-ink mt-0.5">50 / 30 / 20</div>
    </header>
  )
}

interface StackedBarProps {
  result: ReturnType<typeof deriveFiftyThirtyTwenty>
}

function StackedBar({ result }: StackedBarProps) {
  // Cap each segment so a wildly over-spent month doesn't push the bar off the screen.
  const needsPct   = clamp01(result.needs.actualPct)
  const wantsPct   = clamp01(result.wants.actualPct)
  const savingsPct = clamp01(Math.max(0, result.savings.actualPct))
  const total = needsPct + wantsPct + savingsPct
  // Normalize so the bar always fills 100% of width (visual proportion).
  const ns = total > 0 ? needsPct   / total : 0
  const ws = total > 0 ? wantsPct   / total : 0
  const ss = total > 0 ? savingsPct / total : 0

  return (
    <div className="relative h-3 w-full rounded-full overflow-hidden bg-bg border border-rule">
      <div className="absolute inset-y-0 left-0 bg-blue-500"    style={{ width: `${ns * 100}%` }} />
      <div className="absolute inset-y-0 bg-amber-500"          style={{ left: `${ns * 100}%`, width: `${ws * 100}%` }} />
      <div className="absolute inset-y-0 bg-emerald-500"        style={{ left: `${(ns + ws) * 100}%`, width: `${ss * 100}%` }} />
      {/* Target tick marks at 50% and 80% (50+30) */}
      <div className="absolute inset-y-0 w-px bg-ink/40" style={{ left: '50%' }} />
      <div className="absolute inset-y-0 w-px bg-ink/40" style={{ left: '80%' }} />
    </div>
  )
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n > 1) return 1
  return n
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'] as const

function monthName(m: number): string {
  return MONTHS[m - 1] ?? `Month ${m}`
}
