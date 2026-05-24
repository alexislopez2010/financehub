/**
 * Shared row shapes for lib/finance/* modules.
 * Names match the actual Supabase column names (snake_case). Phase 2E may
 * generate these from `supabase gen types`; for now, hand-defined to the
 * subset of fields the finance algorithms care about.
 */

export type TransactionType = 'Income' | 'Expense' | 'Transfer' | 'Refund'

export interface TransactionRow {
  id: string
  household_id: string
  date: string  // ISO yyyy-mm-dd
  description: string
  amount: number  // positive number; sign is implied by `type` (Expense + Transfer-debit = subtract from balance)
  type: TransactionType
  category: string | null
  category_id: string | null
  account: string | null
  member: string | null
  transfer_pair_id: string | null
}

export type BillFrequency = 'Monthly' | 'Biweekly' | 'Weekly' | 'Quarterly' | 'Annual'

export interface BillRow {
  id: string
  household_id: string
  name: string
  category: string | null
  account: string | null
  due_day: number | null  // 1..31 (constrained by Phase 1 CHECK)
  frequency: BillFrequency | null
  budget_amount: number
  is_active: boolean
  notes: string | null
}

export type BillMatchKind = 'category_map' | 'name_keyword'

export interface BillMatchRule {
  id: string
  household_id: string
  bill_id: string | null
  bill_name: string | null
  category: string | null
  sub_category: string | null
  keyword: string | null
  account_filter: string | null
  rule_kind: BillMatchKind
}

export interface IncomePlanRow {
  id: string
  household_id: string
  source: string | null  // e.g., 'Omnicom Shared Services'
  member: string | null
  year: number
  month: number  // 1..12
  expected_amount: number
  is_active: boolean
  // legacy app supports semimonthly + bi-weekly; surface as optional cadence
  cadence?: 'monthly' | 'semimonthly' | 'biweekly' | null
}

export interface DebtRow {
  id: string
  household_id: string
  name: string
  balance: number
  apr: number  // percent, e.g. 18.99 for 18.99%
  min_payment: number
  escrow: number  // monthly escrow portion of min_payment that does NOT reduce principal
  is_active: boolean
}

export interface AccountRow {
  id: string
  household_id: string
  name: string
  type: 'checking' | 'savings' | 'credit' | 'loan' | 'investment'
  institution: string | null
  is_active: boolean
}
