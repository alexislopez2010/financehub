import { Check } from 'lucide-react'

export interface DetectedBannerProps {
  adapterName: string
  rowCount: number
  /** ISO YYYY-MM-DD range. */
  dateRange: { start: string; end: string }
}

const MONTHS: ReadonlyArray<string> = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

interface IsoDateParts {
  year: number
  month: number
  day: number
}

function parseIsoDate(iso: string): IsoDateParts | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || !month || !day) return null
  return { year, month, day }
}

function formatPart(parts: IsoDateParts, includeYear: boolean): string {
  const monthName = MONTHS[parts.month - 1] ?? ''
  const base = `${monthName} ${parts.day}`
  return includeYear ? `${base}, ${parts.year}` : base
}

export function formatRange(startIso: string, endIso: string): string {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)
  if (!start || !end) return `${startIso} – ${endIso}`

  if (start.year !== end.year) {
    return `${formatPart(start, true)} – ${formatPart(end, true)}`
  }
  return `${formatPart(start, false)} – ${formatPart(end, true)}`
}

export function DetectedBanner({ adapterName, rowCount, dateRange }: DetectedBannerProps) {
  const rowsLabel = rowCount === 1 ? '1 row' : `${rowCount} rows`
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
      <Check size={12} aria-hidden="true" />
      <span>{adapterName}</span>
      <span className="text-brand/60" aria-hidden="true">·</span>
      <span>{rowsLabel}</span>
      <span className="text-brand/60" aria-hidden="true">·</span>
      <span>{formatRange(dateRange.start, dateRange.end)}</span>
    </div>
  )
}
