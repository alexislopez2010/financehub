'use client'

import { X } from 'lucide-react'
import type { BillContribution } from '@/lib/plan/billsForCategory'
import { cn } from '@/lib/cn'

export interface BudgetRowBillsDrawerProps {
  /** Display name of the category being drilled. */
  category: string
  /** Human-readable label for the period (e.g., "September 2026"). */
  periodLabel: string
  /** Pre-sorted list of contributing bills (biggest contribution first). */
  bills: ReadonlyArray<BillContribution>
  /** Row's billsCommitted total — shown in the header and matches the sum. */
  totalBillsCommitted: number
  onClose: () => void
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// Month names for anchor-month display. Index 0 unused so we can map 1..12
// directly to the array.
const MONTH_NAMES: ReadonlyArray<string> = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/**
 * Cadence-aware human label for a bill row. Keeps the user's original
 * frequency string but spells out *why* it lands in this period — useful
 * for Quarterly/Annual bills where the user may have forgotten the anchor.
 *
 * Examples:
 *   - Monthly bill  → "Monthly · day 1"
 *   - Biweekly bill → "Biweekly · ~2× this month"
 *   - Quarterly,  anchor Sep → "Quarterly · anchored September"
 *   - Annual,     anchor Apr → "Annual · April only"
 *   - No frequency / no due_day → "—"
 */
function cadenceLabel(bill: BillContribution): string {
  const freq = (bill.frequency ?? '').trim()
  const lf = freq.toLowerCase().replace(/[-_\s]/g, '')
  const anchorName = bill.dueMonthAnchor != null && bill.dueMonthAnchor >= 1 && bill.dueMonthAnchor <= 12
    ? MONTH_NAMES[bill.dueMonthAnchor]
    : null

  if (lf === 'quarterly' || lf === 'quarter') {
    return anchorName ? `Quarterly · anchored ${anchorName}` : 'Quarterly'
  }
  if (lf === 'annual' || lf === 'annually' || lf === 'yearly') {
    return anchorName ? `Annual · ${anchorName} only` : 'Annual'
  }
  if (lf === 'biweekly' || lf === 'semimonthly') {
    return 'Biweekly · ~2× this month'
  }
  if (lf === 'monthly' || lf === '') {
    return bill.dueDay != null ? `Monthly · day ${bill.dueDay}` : 'Monthly'
  }
  // Unknown frequency string — surface it verbatim so we never silently
  // misrepresent the user's data.
  return freq
}

/**
 * Inline drawer rendered beneath a BudgetRow when the user clicks the
 * row's "Bills" cell. Lists every active bill mapped to the row's category
 * that recurs in the selected Plan period, with its cadence, occurrence
 * count, and dollar contribution. The sum of contributions matches the
 * row's billsCommitted total exactly.
 *
 * Pattern mirrors {@link BudgetRowDrawer} (which does the same for actual
 * transactions) so behavior is consistent.
 */
export function BudgetRowBillsDrawer({
  category,
  periodLabel,
  bills,
  totalBillsCommitted,
  onClose
}: BudgetRowBillsDrawerProps) {
  const isEmpty = bills.length === 0

  return (
    <div className="bg-blue-50/40 border-t border-rule px-4 py-3">
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <div className="text-xs text-muted">
          {isEmpty ? (
            <>No bills are mapped to <span className="text-ink font-medium">{category}</span> for {periodLabel}.</>
          ) : (
            <>
              <span className="text-ink font-medium">{bills.length}</span>{' '}
              {bills.length === 1 ? 'bill' : 'bills'} hit{bills.length === 1 ? 's' : ''} {category} in{' '}
              <span className="text-ink font-medium">{periodLabel}</span> ·{' '}
              <span className="text-ink font-medium tabular">{formatUSD(totalBillsCommitted)}</span> committed
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close bills list"
          className="p-1 rounded text-muted hover:text-ink hover:bg-gray-200 shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      {!isEmpty && (
        <ul className="divide-y divide-gray-200/70 rounded-md border border-rule bg-surface overflow-hidden">
          {bills.map(b => (
            <li
              key={b.id}
              className="grid gap-3 items-center px-3 py-2 text-xs hover:bg-gray-50 grid-cols-[1fr_auto_120px] sm:grid-cols-[1fr_auto_120px_120px]"
            >
              <span className="text-ink truncate min-w-0">
                <span className="font-medium">{b.name}</span>
                {b.account && (
                  <span className="text-muted ml-1.5">· {b.account}</span>
                )}
              </span>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-md text-[11px]',
                  'bg-gray-100 text-gray-700'
                )}
                title="Cadence and anchor"
              >
                {cadenceLabel(b)}
              </span>
              <span className="hidden sm:block text-right tabular text-muted">
                {formatUSD(b.perOccurrenceAmount)}
                {b.occurrenceCount > 1 && (
                  <span className="ml-1 text-[11px]">× {b.occurrenceCount}</span>
                )}
              </span>
              <span className="text-right tabular text-ink font-medium">
                {formatUSD(b.contribution)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
