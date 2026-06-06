'use client'

import { X } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'
import type { BriefingKpis, BriefingKpisExtras } from '@/lib/briefing/kpis'
import { deriveBalances, type AccountBalance } from '@/lib/accounts/balances'
import { cn } from '@/lib/cn'

type AccountRow = Tables<'accounts'>
type TransactionRow = Tables<'transactions'>

export type KpiKind =
  | 'cash'
  | 'assets'
  | 'debt'
  | 'net-worth'
  | 'this-month'
  | 'savings-rate'
  | 'burn-rate'

export interface BriefingKpiDrawerProps {
  kind: KpiKind
  onClose: () => void
  accounts: ReadonlyArray<AccountRow>
  transactions: ReadonlyArray<TransactionRow>
  kpis: BriefingKpis
  extras: BriefingKpisExtras
  /** Label shown in the drawer header — e.g. "Cash · $9,625". */
  headerLabel: string
  headerValue: string
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatUSDSigned(n: number): string {
  const abs = Math.abs(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  return n < 0 ? `-${abs}` : abs
}

function formatPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`
}

/**
 * Type-bucket sets — mirrored from briefing/kpis.ts. We don't import them
 * because the constants there aren't exported; keeping a local copy is
 * cheaper than widening that module's surface.
 */
const CASH_TYPES = new Set(['checking', 'savings', 'cash'])
const ASSET_TYPES = new Set(['property', 'asset', 'investment'])
const DEBT_TYPES = new Set(['credit', 'loan', 'mortgage'])

/**
 * Inline drawer that explains a KPI tile by showing the per-account
 * rollup, the formula inputs, or both. Rendered beneath the tile grid
 * so the user doesn't lose their place. Mirrors the BudgetRowDrawer /
 * BudgetRowBillsDrawer pattern from the Plan surface — one drawer open
 * at a time, owned by the parent.
 */
export function BriefingKpiDrawer({
  kind, onClose, accounts, transactions, kpis, extras,
  headerLabel, headerValue
}: BriefingKpiDrawerProps) {
  // Per-account balances for the cash / asset / debt drill-downs.
  // deriveBalances respects starting_balance_date and applies debt-math
  // inversion, so what we display here matches the KPI tile exactly.
  const summary = deriveBalances({ accounts, transactions })

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
        {kind === 'cash' && (
          <AccountList
            rows={summary.accounts.filter(a => a.type && CASH_TYPES.has(a.type))}
            invert={false}
            footerLabel="Total Cash"
            footerValue={kpis.cash}
            emptyLabel="No active cash accounts."
            helperText="Sum of starting balance + signed activity across checking/savings/cash accounts."
          />
        )}

        {kind === 'assets' && (
          <AccountList
            rows={summary.accounts.filter(a => a.type && ASSET_TYPES.has(a.type))}
            invert={false}
            footerLabel="Total Assets"
            footerValue={kpis.assets}
            emptyLabel="No property / investment accounts. Add one from the Accounts page to track home equity."
            helperText="Illiquid value (property, investments). Updated when you bump the balance on each account."
          />
        )}

        {kind === 'debt' && (
          <AccountList
            rows={summary.accounts.filter(a => a.type && DEBT_TYPES.has(a.type))}
            invert={false}
            footerLabel="Total Debt"
            footerValue={kpis.debt}
            emptyLabel="No active debt accounts."
            helperText="Amount owed across credit/loan/mortgage accounts. Charges raise debt; payments lower it."
          />
        )}

        {kind === 'net-worth' && (
          <FormulaBlock
            rows={[
              { label: 'Cash',   value: kpis.cash,  tone: 'positive' as const },
              { label: 'Assets', value: kpis.assets, tone: 'positive' as const },
              { label: 'Debt',   value: -kpis.debt, tone: 'negative' as const }
            ]}
            footerLabel="Net Worth"
            footerValue={kpis.cash + kpis.assets - kpis.debt}
            helperText="Net Worth = Cash + Assets − Debt. Click any of the contributing tiles above to drill into each side."
          />
        )}

        {kind === 'this-month' && (
          <FormulaBlock
            rows={[
              { label: 'Income (this month)',  value: extras.monthIncome,  tone: 'positive' as const },
              { label: 'Expense (this month)', value: -extras.monthExpense, tone: 'negative' as const }
            ]}
            footerLabel="This Month Net"
            footerValue={kpis.thisMonthNet}
            helperText="Income + Refund − Expense for the current calendar month. Transfers between your own accounts are excluded."
          />
        )}

        {kind === 'savings-rate' && (
          <div className="space-y-3">
            <FormulaBlock
              rows={[
                { label: 'Income (this month)',  value: extras.monthIncome,  tone: 'positive' as const },
                { label: 'Expense (this month)', value: extras.monthExpense, tone: 'negative' as const }
              ]}
              footerLabel="Savings Rate"
              footerValue={kpis.savingsRate}
              formatFooter={n => formatPct(n, 1)}
              helperText="Savings Rate = (Income − Expense) ÷ Income. 20%+ is the textbook personal-finance target; below 0% means you spent more than you earned this month."
            />
          </div>
        )}

        {kind === 'burn-rate' && (
          <div className="space-y-3">
            <FormulaBlock
              rows={[
                { label: 'Expense (last 30 days)', value: kpis.burnRate30Day * 30, tone: 'negative' as const }
              ]}
              footerLabel="Burn Rate (per day)"
              footerValue={kpis.burnRate30Day}
              helperText="Burn = trailing-30-day Expense ÷ 30. Counts every Expense on your accounts including credit-card charges; it can overstate cash burn for the month when you're routing spend through credit. Pair with the next line for context."
            />
            <FormulaBlock
              rows={[
                { label: 'Cash on hand',    value: kpis.cash,             tone: 'positive' as const },
                { label: 'Daily burn × 30', value: -kpis.burnRate30Day * 30, tone: 'negative' as const }
              ]}
              footerLabel="Months of Runway"
              footerValue={kpis.monthsOfRunway}
              formatFooter={n => (n >= 99 ? '99+' : `${n.toFixed(1)} mo`)}
              helperText="Runway = Cash ÷ (Burn × 30). Capped at 99 when Burn is zero."
            />
          </div>
        )}
      </div>
    </section>
  )
}

interface AccountListProps {
  rows: ReadonlyArray<AccountBalance>
  invert: boolean
  footerLabel: string
  footerValue: number
  emptyLabel: string
  helperText: string
}

function AccountList({
  rows, footerLabel, footerValue, emptyLabel, helperText
}: AccountListProps) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted py-2">{emptyLabel}</div>
    )
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
          <div className="tabular text-sm tabular">{formatUSD(footerValue)}</div>
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
  /** Optional custom footer formatter for percent/runway/etc. */
  formatFooter?: (n: number) => string
  helperText: string
}

function FormulaBlock({
  rows, footerLabel, footerValue, formatFooter, helperText
}: FormulaBlockProps) {
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
