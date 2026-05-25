'use client'

import { Target } from 'lucide-react'
import type { BudgetSnapshot } from '@/lib/briefing/budgetSnapshot'
import { cn } from '@/lib/cn'

export interface BudgetSnapshotCardProps {
  snapshot: BudgetSnapshot
  /** e.g. "May 2026" */
  monthLabel: string
  className?: string
}

const statusBarClass: Record<BudgetSnapshot['status'], string> = {
  under: 'bg-emerald-500',
  at: 'bg-amber-500',
  over: 'bg-red-500'
}

export function BudgetSnapshotCard({
  snapshot,
  monthLabel,
  className
}: BudgetSnapshotCardProps) {
  const utilizationPct = Math.round((snapshot.utilization ?? 0) * 100)
  const barPct = Math.min(snapshot.utilization ?? 0, 1) * 100
  const hasBudget = snapshot.utilization !== null

  return (
    <section
      className={cn(
        'bg-surface border border-rule rounded-xl p-5 shadow-sm',
        className
      )}
    >
      <header className="flex items-baseline justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-50 text-purple-600">
            <Target size={16} strokeWidth={2} />
          </div>
          <h2 className="text-sm font-semibold text-ink">Budget — This Month</h2>
        </div>
        <span className="text-xs text-muted">{monthLabel}</span>
      </header>

      {!hasBudget ? (
        <div className="space-y-2">
          <p className="text-sm text-muted italic">No budget set.</p>
          <a href="/plan" className="text-xs text-brand underline">
            Set one in Plan
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-2xl font-bold tabular-nums text-ink">
            {formatUSD(snapshot.totalSpent)}{' '}
            <span className="text-base font-normal text-muted">
              of {formatUSD(snapshot.totalBudgeted)}
            </span>
          </div>

          <div
            className="bg-rule h-2 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={utilizationPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Budget utilization"
          >
            <div
              className={cn('h-full rounded-full', statusBarClass[snapshot.status])}
              style={{ width: `${barPct}%` }}
            />
          </div>

          <p className="text-xs text-muted">
            {renderCaption(snapshot, utilizationPct)}
          </p>
        </div>
      )}
    </section>
  )
}

function renderCaption(snapshot: BudgetSnapshot, utilizationPct: number) {
  if (snapshot.status === 'over') {
    return (
      <>
        <span className="text-ink font-medium">
          {formatUSD(Math.abs(snapshot.remaining))}
        </span>{' '}
        over budget · {utilizationPct}% used
      </>
    )
  }
  if (snapshot.status === 'at') {
    return (
      <>
        <span className="text-ink font-medium">
          {formatUSD(snapshot.remaining)}
        </span>{' '}
        remaining · close to limit
      </>
    )
  }
  return (
    <>
      <span className="text-ink font-medium">
        {formatUSD(snapshot.remaining)}
      </span>{' '}
      remaining · {utilizationPct}% used
    </>
  )
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}
