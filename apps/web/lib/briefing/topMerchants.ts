import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>

export interface MerchantSpendRow {
  /** Merchant key derived from normalized description. */
  merchant: string
  /** Sum of |amount| for matching Expense transactions MTD. */
  amount: number
  /** Number of matching Expense transactions MTD. */
  count: number
}

export interface DeriveTopMerchantsInput {
  transactions: ReadonlyArray<Pick<TransactionRow, 'amount' | 'type' | 'date' | 'description'>>
  today: { year: number; month: number }
  /** Default 5. */
  top?: number
}

const DEFAULT_TOP = 5

/**
 * Aggregates Expense transactions for the current calendar month by
 * normalized merchant description and returns the top N by spend.
 *
 * Merchant normalization collapses common variants — trailing transaction
 * ids ("#1234", "*1234"), card-mask suffixes ("XXXX1234"), and trailing
 * date stamps — so that e.g. "TARGET #1234" + "TARGET #5678" surface as
 * a single "TARGET" row.
 */
export function deriveTopMerchants(
  input: DeriveTopMerchantsInput
): ReadonlyArray<MerchantSpendRow> {
  const top = input.top ?? DEFAULT_TOP
  const { year, month } = input.today

  // amount + count keyed by normalized merchant.
  const totals = new Map<string, { amount: number; count: number }>()

  for (const tx of input.transactions) {
    if (tx.type !== 'Expense') continue
    const d = parseDate(tx.date)
    if (!d) continue
    if (d.year !== year || d.month !== month) continue
    const merchant = normalizeMerchant(tx.description)
    if (!merchant) continue
    const cur = totals.get(merchant) ?? { amount: 0, count: 0 }
    totals.set(merchant, { amount: cur.amount + Math.abs(tx.amount), count: cur.count + 1 })
  }

  const rows: MerchantSpendRow[] = [...totals.entries()].map(([merchant, { amount, count }]) => ({
    merchant,
    amount: round2(amount),
    count
  }))

  rows.sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount
    return a.merchant.localeCompare(b.merchant)
  })

  return rows.slice(0, top)
}

/**
 * Lightweight merchant normalization. Collapses trailing transaction-id
 * variants (`#1234`, ` 1234567`, `*1234`, `XXXX1234`, ` 05/12` date stamps),
 * trims, dedupes whitespace, and uppercases.
 *
 * Intentionally simple — overkill normalization breaks more than it helps.
 */
export function normalizeMerchant(description: string): string {
  return description
    .replace(/\s+#?\d{3,}\s*$/, '') // trailing transaction id "#12345" or "1234567"
    .replace(/\s+x{2,}\d+\s*$/i, '') // "XXXX1234" suffix
    .replace(/\s+\*\d+\s*$/, '') // "*1234" suffix
    .replace(/\s+\d{2}\/\d{2}.*$/, '') // trailing date stamp
    .trim()
    .replace(/\s{2,}/g, ' ')
    .toUpperCase()
}

function parseDate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  return { year: +m[1]!, month: +m[2]!, day: +m[3]! }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
