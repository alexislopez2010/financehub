'use client'

import { useMemo, useState } from 'react'
import { useDebts } from '@/lib/data/debts'
import { useAccounts } from '@/lib/data/accounts'
import { useTransactions } from '@/lib/data/transactions'
import { deriveBalances } from '@/lib/accounts/balances'
import { mergeDebtsWithAccounts } from '@/lib/finance/debtAccountMerge'
import { simulatePayoff, type PayoffStrategy } from '@/lib/finance/debt'
import { DebtStrategySelector } from './DebtStrategySelector'
import { PayoffSummary } from './PayoffSummary'
import { DebtList } from './DebtList'
import { cn } from '@/lib/cn'

export function DebtSection() {
  const debtsQ = useDebts()
  const accountsQ = useAccounts()
  const txsQ = useTransactions()
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche')
  const [extraInput, setExtraInput] = useState<string>('100')

  const extraPerMonth = useMemo(() => {
    const n = parseFloat(extraInput)
    return Number.isNaN(n) || n < 0 ? 0 : n
  }, [extraInput])

  // Derive per-account computed balance so the merged debt rows pick up the
  // live truth for any debt linked to an account.
  const summary = useMemo(() => deriveBalances({
    accounts: accountsQ.data ?? [],
    transactions: txsQ.data ?? []
  }), [accountsQ.data, txsQ.data])

  const mergedDebts = useMemo(
    () => mergeDebtsWithAccounts({ debts: debtsQ.data ?? [], summary }),
    [debtsQ.data, summary]
  )

  const plan = useMemo(() => {
    // simulatePayoff expects lib/finance/types.ts DebtRow shape. The merged
    // rows already have null-safe defaults populated.
    const algoDebts = mergedDebts.map(d => ({
      id: d.id,
      household_id: d.household_id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      min_payment: d.min_payment,
      escrow: d.escrow,
      is_active: d.is_active
    }))
    return simulatePayoff(algoDebts, { strategy, extraPerMonth })
  }, [mergedDebts, strategy, extraPerMonth])

  if (debtsQ.isLoading || accountsQ.isLoading || txsQ.isLoading) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        Loading debts…
      </div>
    )
  }

  const err = debtsQ.error || accountsQ.error || txsQ.error
  if (err) {
    return (
      <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-sm text-red-700">
        Failed to load debts: {err.message}
      </div>
    )
  }

  // DebtList still expects a DebtRow-ish shape — the live balance flows through
  // mergedDebts.balance which we splat over each input debt row.
  const debtsForList = (debtsQ.data ?? []).map(d => {
    const m = mergedDebts.find(x => x.id === d.id)
    return m ? { ...d, balance: m.balance } : d
  })

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-rule rounded-xl shadow-sm p-4 sm:p-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted mb-2">Strategy</div>
          <DebtStrategySelector value={strategy} onChange={setStrategy} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted block mb-1">
            Extra payment per month
          </label>
          <div className="flex items-center gap-2 max-w-xs">
            <span className="text-muted">$</span>
            <input
              type="number"
              step="10"
              min="0"
              value={extraInput}
              onChange={e => setExtraInput(e.target.value)}
              disabled={strategy === 'minimum_only'}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm tabular rounded-md border border-rule bg-bg',
                'focus:outline-none focus:ring-2 focus:ring-brand/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          </div>
          {strategy === 'minimum_only' && (
            <p className="text-xs text-muted mt-1 italic">Extra ignored — baseline payoff with minimums only.</p>
          )}
        </div>
      </div>

      <PayoffSummary plan={plan} />
      <DebtList debts={debtsForList} plan={plan} />
    </div>
  )
}
