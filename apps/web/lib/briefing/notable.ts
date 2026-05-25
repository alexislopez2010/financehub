import type { Tables } from '@/lib/supabase/database.types'
import { clampDay } from '@/lib/finance/dueDate'

export type TransactionRow = Tables<'transactions'>
export type BillRow = Tables<'bills'>

export type CalloutKind = 'duplicate_charge' | 'category_swing' | 'slipped_bill'

export interface Callout {
  kind: CalloutKind
  lead: string
  body: string
  impact: number  // abs $ — used to rank
}

export interface NotableInput {
  transactions: ReadonlyArray<TransactionRow>
  bills: ReadonlyArray<BillRow>
  today: { year: number; month: number; day: number }
  /** How many top callouts to keep. Default 3. */
  top?: number
}

/**
 * Returns up to `top` callouts ranked by absolute-dollar impact.
 * Phase 2F implements three rules: duplicate_charge, category_swing,
 * slipped_bill. The other two from the spec (new_merchant,
 * income_variance) are deferred to a later refinement.
 */
export function notableCallouts(input: NotableInput): ReadonlyArray<Callout> {
  const top = input.top ?? 3
  const all: Callout[] = [
    ...findDuplicateCharges(input.transactions, input.today),
    ...findCategorySwings(input.transactions, input.today),
    ...findSlippedBills(input.transactions, input.bills, input.today)
  ]
  all.sort((a, b) => b.impact - a.impact)
  return all.slice(0, top)
}

/**
 * Same description (case-insensitive) + same amount within 7 days of each other.
 * Only flags within the current month's transactions to avoid alert fatigue.
 */
export function findDuplicateCharges(
  transactions: ReadonlyArray<TransactionRow>,
  today: { year: number; month: number; day: number }
): ReadonlyArray<Callout> {
  const monthTx = transactions.filter(tx => {
    const d = parseDate(tx.date)
    if (!d) return false
    if (d.year !== today.year || d.month !== today.month) return false
    return tx.type === 'Expense'
  })

  const buckets = new Map<string, TransactionRow[]>()
  for (const tx of monthTx) {
    const key = `${(tx.description ?? '').toLowerCase().trim()}|${Math.abs(tx.amount).toFixed(2)}`
    let list = buckets.get(key)
    if (!list) {
      list = []
      buckets.set(key, list)
    }
    list.push(tx)
  }

  const out: Callout[] = []
  for (const list of buckets.values()) {
    if (list.length < 2) continue
    // Sort by date to find pairs within 7 days.
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const a = sorted[i]!
      const b = sorted[i + 1]!
      const dayDiff = daysBetween(a.date, b.date)
      if (dayDiff <= 7) {
        const amt = Math.abs(a.amount)
        out.push({
          kind: 'duplicate_charge',
          lead: 'Duplicate charge.',
          body: `${a.description ?? '(no description)'} billed twice between ${a.date} and ${b.date} — $${amt.toFixed(2)} each.`,
          impact: amt
        })
        break  // one per merchant
      }
    }
  }
  return out
}

/**
 * Spending in a category for the current month deviates >15% from the
 * trailing 3-month average. Only flags categories present in the
 * current month with at least one expense.
 */
export function findCategorySwings(
  transactions: ReadonlyArray<TransactionRow>,
  today: { year: number; month: number; day: number }
): ReadonlyArray<Callout> {
  // Sum expense per (category, year-month)
  const sums = new Map<string, number>()  // key = "category|YYYY-MM"
  for (const tx of transactions) {
    if (tx.type !== 'Expense') continue
    const d = parseDate(tx.date)
    if (!d) continue
    const cat = tx.category ?? '(Uncategorized)'
    const key = `${cat}|${d.year}-${String(d.month).padStart(2, '0')}`
    sums.set(key, (sums.get(key) ?? 0) + Math.abs(tx.amount))
  }

  const ym = `${today.year}-${String(today.month).padStart(2, '0')}`
  const out: Callout[] = []
  const categories = new Set<string>()
  for (const k of sums.keys()) categories.add(k.split('|')[0]!)

  for (const cat of categories) {
    const current = sums.get(`${cat}|${ym}`) ?? 0
    if (current === 0) continue

    // Trailing 3 months excluding current.
    const trailing: number[] = []
    for (let i = 1; i <= 3; i += 1) {
      const prev = monthBack(today, i)
      const v = sums.get(`${cat}|${prev.year}-${String(prev.month).padStart(2, '0')}`)
      if (v !== undefined) trailing.push(v)
    }
    if (trailing.length === 0) continue

    const avg = trailing.reduce((s, v) => s + v, 0) / trailing.length
    if (avg === 0) continue
    const pctChange = (current - avg) / avg
    if (Math.abs(pctChange) < 0.15) continue

    const pctLabel = `${Math.round(Math.abs(pctChange) * 100)}%`
    const direction = pctChange > 0 ? 'up' : 'down'
    const delta = Math.abs(current - avg)
    out.push({
      kind: 'category_swing',
      lead: `${cat} ${direction} ${pctLabel}.`,
      body: `$${current.toFixed(2)} this month vs $${avg.toFixed(2)} trailing average.`,
      impact: delta
    })
  }
  return out
}

/**
 * A bill whose due_day was within the last 7 days AND has no matching
 * transaction within ±3 days (by description-contains bill.name).
 * Simple heuristic — Phase 2I bills surface will use bill_match_rules
 * for real matching.
 */
export function findSlippedBills(
  transactions: ReadonlyArray<TransactionRow>,
  bills: ReadonlyArray<BillRow>,
  today: { year: number; month: number; day: number }
): ReadonlyArray<Callout> {
  const out: Callout[] = []
  for (const b of bills) {
    if (!b.is_active) continue
    if (b.due_day == null) continue
    const clamped = clampDay(b.due_day, today.year, today.month)
    const dueDate = `${today.year}-${String(today.month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
    const daysSinceDue = daysBetween(dueDate, todayIso(today))
    if (daysSinceDue < 0 || daysSinceDue > 7) continue  // not yet due, or due more than a week ago

    const billNameLower = b.name.toLowerCase()
    const matched = transactions.some(tx => {
      if (tx.type !== 'Expense') return false
      const txIso = tx.date
      const diff = Math.abs(daysBetween(dueDate, txIso))
      return diff <= 3 && (tx.description ?? '').toLowerCase().includes(billNameLower)
    })
    if (matched) continue

    out.push({
      kind: 'slipped_bill',
      lead: `${b.name} appears unpaid.`,
      body: `Due ${dueDate} ($${b.budget_amount.toFixed(2)}); no matching transaction in the last 3 days.`,
      impact: b.budget_amount
    })
  }
  return out
}

// — helpers —

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]!, day: +m[3]! }
}

function todayIso(today: { year: number; month: number; day: number }): string {
  return `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`
}

function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + 'T00:00:00Z').getTime()
  const b = new Date(isoB + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

function monthBack(today: { year: number; month: number }, n: number): { year: number; month: number } {
  let y = today.year
  let m = today.month - n
  while (m < 1) {
    m += 12
    y -= 1
  }
  return { year: y, month: m }
}
