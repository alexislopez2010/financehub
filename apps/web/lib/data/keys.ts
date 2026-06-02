/**
 * Consolidated query-key factory for all TanStack Query usage in the app.
 * Per the Phase 2 spec: one query key per data type.
 *
 * Keys are typed as readonly tuples so TanStack Query's narrowing works.
 * Optional filter/period args produce a longer key so different filter
 * combinations don't share the same cache slot.
 */

export interface TransactionFilters {
  /** ISO yyyy-mm-dd inclusive. */
  startDate?: string
  /** ISO yyyy-mm-dd inclusive. */
  endDate?: string
  /** Filter by category id (FK). null/undefined = any. */
  categoryId?: string | null
  /** Filter by account string. */
  account?: string
  /** Filter by member string. null = filter to rows where member IS NULL. */
  member?: string | null
  /** Filter by transaction type. */
  type?: 'Income' | 'Expense' | 'Transfer' | 'Refund'
  /** Signed amount lower bound (e.g. -500). Rows with amount >= minAmount match. */
  minAmount?: number
  /** Signed amount upper bound (e.g. 500). Rows with amount <= maxAmount match. */
  maxAmount?: number
}

export interface BudgetPeriod {
  year: number
  month: number  // 1..12
}

export interface IncomePlanPeriod {
  year: number
}

export const queryKeys = {
  transactions: (filters?: TransactionFilters) =>
    filters === undefined
      ? (['transactions'] as const)
      : (['transactions', filters] as const),

  bills: () => ['bills'] as const,
  billMatchRules: () => ['billMatchRules'] as const,
  budgets: (period: BudgetPeriod) => ['budgets', period] as const,
  accounts: () => ['accounts'] as const,
  categories: () => ['categories'] as const,
  incomePlan: (period: IncomePlanPeriod) => ['incomePlan', period] as const,
  householdMembers: () => ['householdMembers'] as const,
  familyMembers: () => ['familyMembers'] as const,

  /** Helper used by mutations to invalidate "all transactions" regardless of filters. */
  allTransactions: () => ['transactions'] as const
}
