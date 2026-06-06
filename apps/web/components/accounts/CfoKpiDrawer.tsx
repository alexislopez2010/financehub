'use client'

import { X } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'
import type { AccountSummary, AccountBalance } from '@/lib/accounts/balances'
import type { CfoKpis } from '@/lib/accounts/cfo'
import { cn } from '@/lib/cn'

type TransactionRow = Tables<'transactions'>
type DebtRow = Tables<'debts'>

export type CfoKpiKind =
  | 'net-worth'
  | 'ytd-income'
  | 'ytd-expense'
  | 'ytd-net'
  | 'total-debt'
  | 'cash-runway'
  | 'cash-on-hand'
  | 'investments'

export interface CfoKpiDrawerProps {
  kind: CfoKpiKind
  onClose: () => void
  summary: AccountSummary
  kpis: CfoKpis
  transactions: ReadonlyArray<TransactionRow>
  debts: ReadonlyArray<DebtRow>
  /** Current year so YTD computations match the parent. */
  year: number
  /** Months elapsed (1..12). For avgMonthlyExpense displays. */
  monthsElapsed: number
  headerLabel: string
  headerValue: string
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatUSDCompact(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function formatUSDSigned(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return n < 0 ? `-${abs}` : abs
}

function formatPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

function formatMonths(n: number): string {
  if (n <= 0) return '—'
  if (n >= 12) return `${(n / 12).toFixed(1)} yr`
  return `${n.toFixed(1)} mo`
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const

const CASH_TYPES = new Set(['checking', 'savings', 'cash'])
const INVESTMENT_TYPES = new Set(['investment', 'property', 'asset'])

/**
 * Inline drawer that explains a CFO KPI tile. Same architecture as
 * BriefingKpiDrawer: rendered beneath the tile grid, owned by the parent,
 * one open at a time. Per-tile renderers either list accounts/debts or
 * show the formula inputs with a helper note.
 */
export function CfoKpiDrawer({
  kind, onClose, summary, kpis, transactions, debts, year, monthsElapsed,
  headerLabel, headerValue
}: CfoKpiDrawerProps) {
  return (
    <section
      role="region"
      aria-label={`Breakdown for ${headerLabel}`}
      className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden"
    >
      <header className="flex items-baseline justify-between px-4 py-3 border-b border-rule bg-bg/40">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
            Breakdown
          </div>
          <div className="text-sm text-ink mt-0.5">
            <span className="font-semibold">{headerLabel}</span>
            <span className="text-muted"> · </span>
            <span className="tabular">{headerValue}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close breakdown"
          className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100"
        >
          <X size={14} />
        </button>
      </header>

      <div className="px-4 py-3 text-sm text-ink">
        {kind === 'net-worth' && (
          <FormulaBlock
            rows={[
              { label: 'Cash on hand',  value: summary.totalCash,        tone: 'positive' },
              { label: 'Investments',   value: summary.totalInvestments, tone: 'positive' },
              { label: 'Total debt',    value: -summary.totalDebt,       tone: 'negative' }
            ]}
            footerLabel="Net Worth"
            footerValue={kpis.netWorth}
            helperText="Net Worth = Cash + Investments − Debt. Debt comes from per-account balances on credit/loan/mortgage accounts. The Total Debt tile uses a separate `debts` table — when that disagrees with this number, one of the two is stale."
          />
        )}

        {kind === 'ytd-income' && (
          <MonthlyBuckets
            transactions={transactions}
            year={year}
            monthsElapsed={monthsElapsed}
            kind="income"
            footerLabel="YTD Income"
            footerValue={kpis.ytdIncome}
            helperText="Sum of |amount| on Income and Refund transactions dated in the current calendar year. Transfers are excluded."
          />
        )}

        {kind === 'ytd-expense' && (
          <MonthlyBuckets
            transactions={transactions}
            year={year}
            monthsElapsed={monthsElapsed}
            kind="expense"
            footerLabel="YTD Expense"
            footerValue={kpis.ytdExpense}
            helperText={`Sum of |amount| on Expense transactions dated in ${year}. Average ${formatUSDCompact(kpis.avgMonthlyExpense)} per month across ${monthsElapsed} month${monthsElapsed === 1 ? '' : 's'} elapsed.`}
          />
        )}

        {kind === 'ytd-net' && (
          <FormulaBlock
            rows={[
              { label: 'YTD Income',  value: kpis.ytdIncome,  tone: 'positive' },
              { label: 'YTD Expense', value: -kpis.ytdExpense, tone: 'negative' }
            ]}
            footerLabel="YTD Net"
            footerValue={kpis.ytdNet}
            helperText={`Savings rate = YTD Net ÷ YTD Income = ${formatPct(kpis.savingsRate)}. 20%+ is the textbook personal-finance target.`}
          />
        )}

        {kind === 'total-debt' && (
          <DebtList
            debts={debts}
            footerValue={kpis.totalDebt}
            ytdIncome={kpis.ytdIncome}
            dtiRatio={kpis.debtToIncomeRatio}
          />
        )}

        {kind === 'cash-runway' && (
          <FormulaBlock
            rows={[
              { label: 'Cash on hand',          value: summary.totalCash,        tone: 'positive' },
              { label: 'Avg monthly expense',   value: -kpis.avgMonthlyExpense,  tone: 'negative' }
            ]}
            footerLabel="Runway"
            footerValue={kpis.cashRunwayMonths}
            formatFooter={formatMonths}
            helperText="Runway = Cash ÷ avg monthly expense (YTD). It assumes you stop earning today and keep spending at the current pace. A '—' means avg expense is zero (probably an empty data set)."
          />
        )}

        {kind === 'cash-on-hand' && (
          <AccountList
            rows={summary.accounts.filter(a => a.type && CASH_TYPES.has(a.type))}
            footerLabel="Total Cash"
            footerValue={summary.totalCash}
            emptyLabel="No active cash accounts."
            helperText="Sum of starting balance + signed activity across checking/savings/cash accounts. Respects each account's starting_balance_date so transactions before the user's set point don't double-count."
          />
        )}

        {kind === 'investments' && (
          <AccountList
            rows={summary.accounts.filter(a => a.type && INVESTMENT_TYPES.has(a.type))}
            footerLabel="Total Investments"
            footerValue={summary.totalInvestments}
            emptyLabel="No investment accounts. Add brokerage / 401k / property entries via the Accounts page to populate this tile."
            helperText="Illiquid value: property, brokerage, retirement. Usually updated by clicking the balance on each account row and entering the latest statement figure."
          />
        )}
      </div>
    </section>
  )
}

interface AccountListProps {
  rows: ReadonlyArray<AccountBalance>
  footerLabel: string
  footerValue: number
  emptyLabel: string
  helperText: string
}

function AccountList({ rows, footerLabel, footerValue, emptyLabel, helperText }: AccountListProps) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted py-2">{emptyLabel}</div>
  }
  return (
    <>
      <ul className="divide-y divide-gray-100 -mx-4">
        {rows.map(r => (
          <li
            key={r.accountId}
            className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink truncate">{r.name}</div>
              <div className="text-[11px] text-muted">
                {r.type ?? 'untyped'}
                {r.owner && r.owner !== 'Shared' ? ` · ${r.owner}` : ''}
                {r.owner === 'Shared' ? ' · shared' : ''}
              </div>
            </div>
            <div className="tabular text-sm text-ink font-medium">
              {formatUSD(r.currentBalance)}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2 bg-bg/40 font-semibold">
          <div className="text-sm">{footerLabel}</div>
          <div className="tabular text-sm">{formatUSD(footerValue)}</div>
        </li>
      </ul>
      <p className="text-[11px] text-muted mt-3">{helperText}</p>
    </>
  )
}

interface DebtListProps {
  debts: ReadonlyArray<DebtRow>
  footerValue: number
  ytdIncome: number
  dtiRatio: number
}

function DebtList({ debts, footerValue, ytdIncome, dtiRatio }: DebtListProps) {
  // Match cfo.ts: active + positive-balance only.
  const active = debts.filter(d => d.is_active && d.balance > 0)
  if (active.length === 0) {
    return <div className="text-xs text-muted py-2">No active debts. The Total Debt tile uses the dedicated debts table, not the per-account credit/loan balances.</div>
  }
  // Sort by balance desc so the biggest liabilities surface first.
  const sorted = [...active].sort((a, b) => b.balance - a.balance)
  return (
    <>
      <ul className="divide-y divide-gray-100 -mx-4">
        {sorted.map(d => (
          <li
            key={d.id}
            className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink truncate">{d.name}</div>
              <div className="text-[11px] text-muted">
                {d.type}
                {d.apr != null ? ` · ${d.apr.toFixed(2)}% APR` : ''}
                {d.min_payment != null && d.min_payment > 0 ? ` · ${formatUSDCompact(d.min_payment)}/mo min` : ''}
              </div>
            </div>
            <div className="tabular text-sm text-ink font-medium">
              {formatUSD(d.balance)}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2 bg-bg/40 font-semibold">
          <div className="text-sm">Total Debt</div>
          <div className="tabular text-sm">{formatUSD(footerValue)}</div>
        </li>
      </ul>
      <p className="text-[11px] text-muted mt-3">
        Sum of active debts with a positive balance. Debt-to-income = Total Debt ÷ YTD Income = {ytdIncome > 0 ? formatPct(dtiRatio) : 'n/a'}. {' '}
        Rule of thumb: under 36% is comfortable, 36–50% is manageable, above 50% is stressed.
      </p>
    </>
  )
}

interface MonthlyBucketsProps {
  transactions: ReadonlyArray<TransactionRow>
  year: number
  monthsElapsed: number
  kind: 'income' | 'expense'
  footerLabel: string
  footerValue: number
  helperText: string
}

function MonthlyBuckets({
  transactions, year, monthsElapsed, kind, footerLabel, footerValue, helperText
}: MonthlyBucketsProps) {
  // Bucket YTD income or expense by month.
  const yearPrefix = `${year}-`
  const buckets: number[] = Array(12).fill(0)
  for (const tx of transactions) {
    if (!tx.date.startsWith(yearPrefix)) continue
    const month = parseInt(tx.date.slice(5, 7), 10)
    if (!Number.isFinite(month) || month < 1 || month > 12) continue
    if (kind === 'income') {
      if (tx.type === 'Income' || tx.type === 'Refund') buckets[month - 1]! += Math.abs(tx.amount)
    } else {
      if (tx.type === 'Expense') buckets[month - 1]! += Math.abs(tx.amount)
    }
  }
  // Only show months 1..monthsElapsed.
  const tone = kind === 'income' ? 'text-emerald-600' : 'text-red-600'
  return (
    <>
      <ul className="divide-y divide-gray-100 -mx-4">
        {buckets.slice(0, monthsElapsed).map((amt, i) => (
          <li
            key={i}
            className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2"
          >
            <div className="text-sm text-ink">
              {MONTH_NAMES[i]} {year}
            </div>
            <div className={cn('tabular text-sm', tone, amt === 0 && 'text-muted')}>
              {amt === 0 ? '—' : formatUSD(amt)}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2 bg-bg/40 font-semibold">
          <div className="text-sm">{footerLabel}</div>
          <div className="tabular text-sm">{formatUSD(footerValue)}</div>
        </li>
      </ul>
      <p className="text-[11px] text-muted mt-3">{helperText}</p>
    </>
  )
}

interface FormulaBlockProps {
  rows: ReadonlyArray<{ label: string; value: number; tone: 'positive' | 'negative' | 'neutral' }>
  footerLabel: string
  footerValue: number
  formatFooter?: (n: number) => string
  helperText: string
}

function FormulaBlock({ rows, footerLabel, footerValue, formatFooter, helperText }: FormulaBlockProps) {
  return (
    <>
      <ul className="divide-y divide-gray-100 -mx-4">
        {rows.map((r, i) => (
          <li
            key={`${r.label}-${i}`}
            className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2"
          >
            <div className="text-sm text-ink">{r.label}</div>
            <div
              className={cn(
                'tabular text-sm font-medium',
                r.tone === 'positive' ? 'text-emerald-600' : r.tone === 'negative' ? 'text-red-600' : 'text-ink'
              )}
            >
              {formatUSDSigned(r.value)}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2 bg-bg/40 font-semibold">
          <div className="text-sm">{footerLabel}</div>
          <div className="tabular text-sm">
            {formatFooter ? formatFooter(footerValue) : formatUSDSigned(footerValue)}
          </div>
        </li>
      </ul>
      <p className="text-[11px] text-muted mt-3">{helperText}</p>
    </>
  )
}
