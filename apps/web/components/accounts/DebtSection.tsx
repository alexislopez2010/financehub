'use client'

import { useMemo, useState } from 'react'
import { useDebts } from '@/lib/data/debts'
import { simulatePayoff, type PayoffStrategy } from '@/lib/finance/debt'
import { DebtStrategySelector } from './DebtStrategySelector'
import { PayoffSummary } from './PayoffSummary'
import { DebtList } from './DebtList'
import { cn } from '@/lib/cn'

export function DebtSection() {
  const debtsQ = useDebts()
  const [strategy, setStrategy] = useState<PayoffStrategy>('avalanche')
  const [extraInput, setExtraInput] = useState<string>('100')

  const extraPerMonth = useMemo(() => {
    const n = parseFloat(extraInput)
    return Number.isNaN(n) || n < 0 ? 0 : n
  }, [extraInput])

  const plan = useMemo(() => {
    const debts = debtsQ.data ?? []
    // simulatePayoff expects lib/finance/types.ts DebtRow shape (no nulls).
    // Map DB row → algorithm row with null-safe defaults.
    const algoDebts = debts.map(d => ({
      id: d.id,
      household_id: d.household_id,
      name: d.name,
      balance: d.balance,
      apr: d.apr ?? 0,
      min_payment: d.min_payment ?? 0,
      escrow: d.escrow ?? 0,
      is_active: d.is_active
    }))
    return simulatePayoff(algoDebts, { strategy, extraPerMonth })
  }, [debtsQ.data, strategy, extraPerMonth])

  if (debtsQ.isLoading) {
    return (
      <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
        Loading debts…
      </div>
    )
  }

  if (debtsQ.error) {
    return (
      <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm text-sm text-red-700">
        Failed to load debts: {debtsQ.error.message}
      </div>
    )
  }

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
      <DebtList debts={debtsQ.data ?? []} plan={plan} />
    </div>
  )
}
