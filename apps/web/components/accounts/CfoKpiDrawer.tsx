'use client'

import { useMemo, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'
import type { AccountSummary, AccountBalance } from '@/lib/accounts/balances'
import type { CfoKpis } from '@/lib/accounts/cfo'
import { deriveCfoExpenseByCategory } from '@/lib/accounts/cfoExpenseByCategory'
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
          <CashRunwayBreakdown
            cashOnHand={summary.totalCash}
            avgMonthlyExpense={kpis.avgMonthlyExpense}
            runwayMonths={kpis.cashRunwayMonths}
            transactions={transactions}
            year={year}
            monthsElapsed={monthsElapsed}
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

/**
 * Cash Runway breakdown. Shows the same formula (Cash ÷ avg monthly expense
 * = Runway) at the top, then breaks the avg-monthly-expense denominator into
 * its category contributors. Each category row is clickable; clicking expands
 * to show the YTD transactions that fed that bucket, biggest first.
 */
interface CashRunwayBreakdownProps {
  cashOnHand: number
  avgMonthlyExpense: number
  runwayMonths: number
  transactions: ReadonlyArray<TransactionRow>
  year: number
  monthsElapsed: number
}

function CashRunwayBreakdown({
  cashOnHand, avgMonthlyExpense, runwayMonths, transactions, year, monthsElapsed
}: CashRunwayBreakdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  const rows = useMemo(
    () => deriveCfoExpenseByCategory({ transactions, year, monthsElapsed }),
    [transactions, year, monthsElapsed]
  )

  // O(1) lookup so the expansion can resolve transaction IDs without rescanning.
  const txById = useMemo(() => {
    const m = new Map<string, TransactionRow>()
    for (const tx of transactions) m.set(tx.id, tx)
    return m
  }, [transactions])

  function toggleCategory(cat: string) {
    setExpandedCategory(prev => (prev === cat ? null : cat))
  }

  return (
    <>
      {/* Top: the runway formula itself. */}
      <ul className="divide-y divide-gray-100 -mx-4">
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2">
          <div className="text-sm text-ink">Cash on hand</div>
          <div className="tabular text-sm font-medium text-emerald-600">
            {formatUSDSigned(cashOnHand)}
          </div>
        </li>
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2">
          <div className="text-sm text-ink">Avg monthly expense</div>
          <div className="tabular text-sm font-medium text-red-600">
            {formatUSDSigned(-avgMonthlyExpense)}
          </div>
        </li>
        <li className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-2 bg-bg/40 font-semibold">
          <div className="text-sm">Runway</div>
          <div className="tabular text-sm">{formatMonths(runwayMonths)}</div>
        </li>
      </ul>

      {/* Section header for the category breakdown. */}
      <div className="mt-4 mb-1 pb-1 border-b border-rule">
        <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted">
          Average expense by category · YTD {year}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-xs text-muted py-3">
          No Expense transactions in {year} yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 -mx-4">
          {rows.map(r => {
            const isOpen = expandedCategory === r.category
            return (
              <li key={r.category}>
                <button
                  type="button"
                  onClick={() => toggleCategory(r.category)}
                  aria-expanded={isOpen}
                  className="w-full grid grid-cols-[12px_1fr_auto_auto] gap-3 items-center px-4 py-2 text-left hover:bg-bg/40 focus:bg-bg/40 focus:outline-none"
                >
                  <ChevronRight
                    size={12}
                    className={cn(
                      'text-muted transition-transform',
                      isOpen && 'rotate-90'
                    )}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-ink truncate">{r.category}</div>
                    <div className="text-[11px] text-muted">
                      {r.count} {r.count === 1 ? 'transaction' : 'transactions'}
                      <span className="mx-1.5">·</span>
                      {formatUSDCompact(r.totalYtd)} total
                    </div>
                  </div>
                  <div className="tabular text-[11px] text-muted">
                    {formatPct(r.shareOfTotal, 0)}
                  </div>
                  <div className="tabular text-sm text-red-600 font-medium whitespace-nowrap">
                    {formatUSDCompact(r.avgMonthly)}/mo
                  </div>
                </button>
                {isOpen && (
                  <CategoryTransactionsList
                    transactionIds={r.transactionIds}
                    txById={txById}
                  />
                )}
              </li>
            )
          })}
          <li className="grid grid-cols-[12px_1fr_auto_auto] gap-3 items-center px-4 py-2 bg-bg/40 font-semibold">
            <div />
            <div className="text-sm">Total avg monthly</div>
            <div className="tabular text-[11px] text-muted">100%</div>
            <div className="tabular text-sm whitespace-nowrap">
              {formatUSDCompact(avgMonthlyExpense)}/mo
            </div>
          </li>
        </ul>
      )}

      <p className="text-[11px] text-muted mt-3">
        Runway = Cash ÷ avg monthly expense (YTD). Click a category to see the contributing
        transactions for {year} YTD. Avg monthly per category = (YTD spend in that category) ÷ {monthsElapsed} {monthsElapsed === 1 ? 'month' : 'months'} elapsed.
      </p>
    </>
  )
}

interface CategoryTransactionsListProps {
  transactionIds: ReadonlyArray<string>
  txById: ReadonlyMap<string, TransactionRow>
}

/** Cap to keep the drawer from becoming a wall of rows on huge categories. */
const CATEGORY_TX_CAP = 50

function CategoryTransactionsList({ transactionIds, txById }: CategoryTransactionsListProps) {
  const sorted = useMemo(() => {
    const txs: TransactionRow[] = []
    for (const id of transactionIds) {
      const tx = txById.get(id)
      if (tx) txs.push(tx)
    }
    // Biggest contributors first — what the user actually wants to see.
    txs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    return txs
  }, [transactionIds, txById])

  const shown = sorted.slice(0, CATEGORY_TX_CAP)
  const omitted = sorted.length - shown.length

  return (
    <ul className="divide-y divide-gray-100 bg-bg/20">
      {shown.map(tx => (
        <li
          key={tx.id}
          className="grid grid-cols-[64px_1fr_auto] gap-3 items-center pl-12 pr-4 py-1.5"
        >
          <div className="text-[11px] text-muted tabular">{tx.date.slice(5)}</div>
          <div className="text-[12px] text-ink truncate" title={tx.description}>
            {tx.description}
          </div>
          <div className="tabular text-[12px] text-red-600 whitespace-nowrap">
            -{formatUSD(Math.abs(tx.amount))}
          </div>
        </li>
      ))}
      {omitted > 0 && (
        <li className="pl-12 pr-4 py-1.5 text-[11px] text-muted italic">
          + {omitted} more transaction{omitted === 1 ? '' : 's'} not shown.
        </li>
      )}
    </ul>
  )
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
