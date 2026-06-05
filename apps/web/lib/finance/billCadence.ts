import { clampDay, daysInMonth } from './dueDate'

/**
 * Normalize a free-text bill frequency into a small enum the cadence logic
 * understands. Self-contained — we don't import `normalizeCadence` from
 * forecast.ts because forecast.ts re-uses this module, and a cycle would
 * cause bundler issues. The mapping is intentionally narrow: anything we
 * can't confidently identify as "every two weeks" / "twice a month" falls
 * back to monthly so the user sees the old behavior for unfamiliar values.
 */
type NormalizedCadence = 'monthly' | 'biweekly' | 'quarterly' | 'annual'

function normalizeBillCadence(freq: string | null | undefined): NormalizedCadence {
  if (!freq) return 'monthly'
  const n = freq.toLowerCase().replace(/[-_\s]/g, '')
  if (n === 'biweekly' || n === 'semimonthly') return 'biweekly'
  if (n === 'quarterly' || n === 'quarter' || n === 'every3months' || n === 'every3month') return 'quarterly'
  if (n === 'annual' || n === 'annually' || n === 'yearly' || n === 'everyyear' || n === 'every12months') return 'annual'
  return 'monthly'
}

/**
 * Bill input shape for cadence-aware due-date checks. Only the fields we
 * actually read — keeps callers from having to construct a full BillRow.
 *
 * `due_month_anchor` is meaningful only for Quarterly and Annual cadences:
 *   - Quarterly: bill is due in month `due_month_anchor` plus every 3rd
 *     month thereafter (e.g., anchor=3 → Mar/Jun/Sep/Dec)
 *   - Annual: bill is due only in month `due_month_anchor`
 * NULL anchor on Quarterly/Annual means "not scheduled" — the bill won't
 * appear in any plan/forecast/coming-due output until the user sets it.
 */
export interface BillCadenceInput {
  readonly due_day: number | null
  readonly frequency: string | null
  readonly due_month_anchor?: number | null
  /**
   * ISO timestamp of when the bill was created. Optional — when present,
   * Quarterly/Annual cadences use it to anchor the FIRST occurrence
   * (matches the UI label "Anchor month (first occurrence)"). Without it,
   * the cadence falls back to treating the anchor as a cycle position
   * (legacy behavior — kept so we don't break test fixtures that don't
   * supply a created_at).
   */
  readonly created_at?: string | null
}

/**
 * Returns true when the supplied bill is due on the given calendar date,
 * respecting `frequency`. Falls back to monthly semantics when frequency is
 * null or unrecognized so behavior is identical to the legacy `isDueOn`
 * helper for the (overwhelmingly common) monthly case.
 *
 * Cadence rules:
 *   - 'monthly'    → one occurrence per calendar month, at `clampDay(due_day)`
 *   - 'biweekly'   → two occurrences per calendar month: at `clampDay(due_day)`
 *                    and at `due_day + 14` (clamped). If `due_day + 14` exceeds
 *                    the month's length, the second occurrence rolls into the
 *                    following month — which we detect by checking whether
 *                    the PREVIOUS month's first occurrence + 14 lands on `date`.
 *   - 'semimonthly'→ alias for biweekly here (semantically "twice a month").
 *                    For income this means 15th + last day; for bills the only
 *                    sensible anchor we have is `due_day`, so we use the same
 *                    "due_day and due_day + 14" rule.
 *
 * Weekly / quarterly / annual are not represented in the user's data and the
 * schema has no field to anchor them, so they fall back to monthly. Caller
 * code that needs richer cadences will need a schema change first.
 */
export function isBillDueOn(
  bill: BillCadenceInput,
  date: { year: number; month: number; day: number }
): boolean {
  if (bill.due_day == null) return false

  const cadence = normalizeBillCadence(bill.frequency)

  // Quarterly + Annual: gated by the anchor month. Without an anchor the
  // bill has no schedule and we return false (the caller surfaces this as
  // "not scheduled — set an anchor month").
  if (cadence === 'quarterly' || cadence === 'annual') {
    const anchor = bill.due_month_anchor
    if (anchor == null || anchor < 1 || anchor > 12) return false
    if (cadence === 'annual' && date.month !== anchor) return false
    if (cadence === 'quarterly') {
      // (month - anchor) ≡ 0 (mod 3), normalized to a positive remainder
      // so Dec-anchor / Mar-test still works (e.g., anchor=12, month=3 →
      // 3 - 12 = -9 → mod 3 == 0 ✓)
      const diff = ((date.month - anchor) % 3 + 3) % 3
      if (diff !== 0) return false
    }
    return clampDay(bill.due_day, date.year, date.month) === date.day
  }

  const firstThisMonth = clampDay(bill.due_day, date.year, date.month)

  // First occurrence: identical across all cadences.
  if (firstThisMonth === date.day) return true

  if (cadence === 'biweekly') {
    // Second occurrence within this month, if due_day + 14 still fits.
    const lastDay = daysInMonth(date.year, date.month)
    if (bill.due_day + 14 <= lastDay && bill.due_day + 14 === date.day) {
      return true
    }

    // Overflow into next month: if the PREVIOUS month's first occurrence
    // (due_day clamped) + 14 lands on `date`, this is the second occurrence
    // of the previous month's biweekly pair. Example: due_day=25 in a
    // 30-day month → 25 + 14 = 39 → rolls to day 9 of next month.
    const prevMonth = date.month === 1 ? 12 : date.month - 1
    const prevYear = date.month === 1 ? date.year - 1 : date.year
    const prevLastDay = daysInMonth(prevYear, prevMonth)
    const prevFirst = clampDay(bill.due_day, prevYear, prevMonth)
    if (prevFirst + 14 > prevLastDay) {
      const rolled = prevFirst + 14 - prevLastDay
      if (rolled === date.day) return true
    }
  }

  return false
}

/**
 * Average number of times this bill recurs in a calendar month, given its
 * frequency. Used to convert a per-occurrence `budget_amount` into a
 * monthly-equivalent commitment (e.g., for the Plan surface's
 * "bills committed" column).
 *
 * Returns an integer count for monthly/biweekly today. If we ever surface
 * weekly/quarterly/annual cadences, this is the right place to extend.
 */
export function monthlyOccurrenceCount(bill: BillCadenceInput): number {
  // due_day being null only affects schedulability on a specific calendar
  // day; for monthly aggregate commitment we still count the bill once.
  // Callers that need to know whether the bill is schedulable should check
  // due_day separately.
  switch (normalizeBillCadence(bill.frequency)) {
    case 'biweekly': return 2
    case 'quarterly':
    case 'annual':
      // Non-monthly cadences need the specific calendar month to answer
      // correctly. monthlyOccurrenceCount is the *average* — caller should
      // use occurrencesInMonth(bill, year, month) instead.
      return 1
    case 'monthly':
    default:         return 1
  }
}

/**
 * Number of times the bill is due in a specific calendar month.
 * Period-aware version of {@link monthlyOccurrenceCount} — the right
 * thing to call when summing per-period commitments (e.g., the Plan
 * surface's "Bills committed" column for a specific month).
 *
 * Returns 0 when the bill is not scheduled for that month (quarterly
 * skips, annual outside its anchor month, NULL anchor on quarterly/
 * annual, etc.).
 */
export function occurrencesInMonth(
  bill: BillCadenceInput,
  year: number,
  month: number
): number {
  if (month < 1 || month > 12) return 0
  const cadence = normalizeBillCadence(bill.frequency)

  if (cadence === 'monthly') return 1
  if (cadence === 'biweekly') return 2

  if (cadence === 'annual' || cadence === 'quarterly') {
    const anchor = bill.due_month_anchor
    if (anchor == null) return 0
    if (anchor < 1 || anchor > 12) return 0
    if (cadence === 'annual') {
      if (month !== anchor) return 0
    } else {
      // (month - anchor) ≡ 0 (mod 3), normalized to a positive remainder
      // so Dec-anchor / Mar-test wraps correctly.
      const diff = ((month - anchor) % 3 + 3) % 3
      if (diff !== 0) return 0
    }

    // "Anchor month (first occurrence)" UI semantics: the bill starts
    // hitting on the first cycle-month at or after the bill's created_at.
    // Without this, a Quarterly anchored to Sep created in June would
    // retroactively count June (which is "in cycle" but BEFORE the user's
    // expected first hit). Only gates when created_at is supplied; legacy
    // call sites without it keep the pure-cycle behavior.
    if (bill.created_at) {
      const created = parseYearMonth(bill.created_at)
      if (created) {
        const firstOccurrenceYear = created.month <= anchor
          ? created.year
          : created.year + 1
        if (year < firstOccurrenceYear) return 0
        if (year === firstOccurrenceYear && month < anchor) return 0
      }
    }

    return 1
  }
  // Defensive: unknown cadence → treat as monthly.
  void year
  return 1
}

function parseYearMonth(iso: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso)
  if (!m) return null
  const year = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10)
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

/**
 * First occurrence of the bill on or after `from`, scanned within a 366-day
 * window so any cadence the system supports (monthly, biweekly, quarterly,
 * annual) is covered. Returns null when:
 *   - due_day is null (bill is unscheduled)
 *   - Quarterly/Annual bill has no due_month_anchor
 *   - No occurrence falls within the window (defensive — shouldn't happen
 *     for the cadences we currently support)
 *
 * Centralizes "when does this bill hit next?" so the Bills row label, the
 * Bills sort comparator, and the Bills summary all agree with Plan and
 * Forecast on quarterly/annual cadences. Before this helper, the row UI
 * used a monthly-only walk and reported e.g. "due July 1" for a Quarterly
 * bill anchored to September.
 */
export function nextBillOccurrence(
  bill: BillCadenceInput,
  from: { year: number; month: number; day: number }
): { daysUntil: number; date: { year: number; month: number; day: number } } | null {
  if (bill.due_day == null) return null
  const occurrences = billOccurrencesIn(bill, from, 366)
  return occurrences[0] ?? null
}

/**
 * All calendar dates inside [start, start + windowDays] (inclusive) on which
 * the bill is due. Returned in ascending chronological order. Same cadence
 * rules as {@link isBillDueOn}.
 *
 * Walks day-by-day rather than computing occurrences arithmetically — keeps
 * the implementation tiny and lets it reuse {@link isBillDueOn}'s edge cases
 * (overflow, leap year, clamping) for free.
 */
export function billOccurrencesIn(
  bill: BillCadenceInput,
  start: { year: number; month: number; day: number },
  windowDays: number
): ReadonlyArray<{ daysUntil: number; date: { year: number; month: number; day: number } }> {
  if (bill.due_day == null) return []
  if (windowDays < 0) return []

  const out: Array<{ daysUntil: number; date: { year: number; month: number; day: number } }> = []
  let cursor = new Date(Date.UTC(start.year, start.month - 1, start.day))

  for (let offset = 0; offset <= windowDays; offset += 1) {
    const date = {
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      day: cursor.getUTCDate()
    }
    if (isBillDueOn(bill, date)) {
      out.push({ daysUntil: offset, date })
    }
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return out
}
