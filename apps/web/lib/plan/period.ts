export interface PlanPeriod {
  year: number
  month: number  // 1..12
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/** Today's period — used as initial default. */
export function currentPeriod(now: Date = new Date()): PlanPeriod {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export function periodLabel(p: PlanPeriod): string {
  const name = MONTH_NAMES[p.month - 1] ?? String(p.month)
  return `${name} ${p.year}`
}

export function periodLabelShort(p: PlanPeriod): string {
  return periodLabel(p).toUpperCase()
}

/**
 * Parse year/month from URL string params. Returns fallback when either is
 * missing or invalid (year < 1900 or > 2200; month outside 1..12).
 */
export function parsePeriod(
  yearStr: string | null,
  monthStr: string | null,
  fallback: PlanPeriod
): PlanPeriod {
  if (!yearStr || !monthStr) return fallback
  const y = parseInt(yearStr, 10)
  const m = parseInt(monthStr, 10)
  if (!Number.isInteger(y) || !Number.isInteger(m)) return fallback
  if (y < 1900 || y > 2200) return fallback
  if (m < 1 || m > 12) return fallback
  return { year: y, month: m }
}

/** Move forward (1) or backward (-1) by one calendar month. Safe across year boundaries. */
export function navigatePeriod(p: PlanPeriod, direction: -1 | 1): PlanPeriod {
  const m = p.month + direction
  if (m < 1) return { year: p.year - 1, month: 12 }
  if (m > 12) return { year: p.year + 1, month: 1 }
  return { year: p.year, month: m }
}

/** Returns the ISO date range covering the period [first, last] inclusive. */
export function periodToRange(p: PlanPeriod): { startDate: string; endDate: string } {
  const start = `${p.year}-${String(p.month).padStart(2, '0')}-01`
  const lastDay = new Date(p.year, p.month, 0).getDate()
  const end = `${p.year}-${String(p.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate: start, endDate: end }
}
