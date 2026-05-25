import { cn } from '@/lib/cn'
import type { ImportRow } from '@/lib/import/adapters/types'

const MONTHS: ReadonlyArray<string> = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const month = Number(m[2])
  const day = Number(m[3])
  const name = MONTHS[month - 1] ?? ''
  return `${name} ${day}`
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

const typeAmountTone: Record<string, string> = {
  Income: 'text-emerald-600',
  Refund: 'text-emerald-600',
  Expense: 'text-red-600',
  Transfer: 'text-muted'
}

export interface PreviewRowProps {
  row: ImportRow
  /** Resolved category name (when row.categoryId is set). */
  categoryName: string | null
  /** Whether to render at duplicate-row opacity (60%). */
  duplicate?: boolean
}

export function PreviewRow({ row, categoryName, duplicate = false }: PreviewRowProps) {
  const tone = typeAmountTone[row.type] ?? 'text-ink'
  const sign = row.type === 'Income' || row.type === 'Refund'
    ? '+'
    : row.type === 'Expense'
      ? '−'
      : ''

  return (
    <div
      className={cn(
        'grid gap-3 items-center px-4 py-2 text-sm border-t border-rule first:border-t-0',
        'grid-cols-[60px_1fr_120px_100px] sm:grid-cols-[60px_1fr_180px_100px]',
        duplicate && 'opacity-60'
      )}
    >
      <div className="text-xs text-muted tabular">{formatShortDate(row.date)}</div>
      <div className="text-ink truncate" title={row.description}>
        {truncate(row.description, 60)}
      </div>
      <div className="hidden sm:block text-xs">
        {categoryName ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-gray-100 text-gray-700">
            {categoryName}
          </span>
        ) : (
          <span className="italic text-muted">Uncategorized</span>
        )}
      </div>
      <div className={cn('text-right tabular font-medium', tone)}>
        {sign}{formatUSD(Math.abs(row.amount))}
      </div>
    </div>
  )
}
