import type { Tables } from '@/lib/supabase/database.types'
import type { PlanPeriod } from './period'

type BillRow = Tables<'bills'>
type BudgetRow = Tables<'budgets'>
type CategoryRow = Tables<'categories'>

export interface OrphanBill {
  bill: BillRow
  category: { id: string; name: string }
}

export interface FindOrphanBillsInput {
  bills: ReadonlyArray<BillRow>
  budgets: ReadonlyArray<BudgetRow>
  categories: ReadonlyArray<Pick<CategoryRow, 'id' | 'name'>>
  period: PlanPeriod
}

/**
 * Bills with `is_active=true` and a non-null `budget_category_id`, whose
 * category has NO budget row in the given (year, month) period. These are
 * recurring obligations the user has mapped but hasn't budgeted for —
 * surfacing them prevents silent gaps in the plan.
 *
 * Bills with `budget_category_id IS NULL` are NOT included (those are
 * "unmapped" — a different problem surfaced by the bills-bulk-mapping UI).
 *
 * Sorted by `budget_amount DESC` (biggest first — most likely to need a budget).
 */
export function findOrphanBills(input: FindOrphanBillsInput): ReadonlyArray<OrphanBill> {
  const { bills, budgets, categories, period } = input

  // 1. Build the set of category_ids that DO have a budget row in this period.
  const budgetedCategoryIds = new Set<string>()
  for (const b of budgets) {
    if (b.year !== period.year || b.month !== period.month) continue
    if (b.category_id == null) continue
    budgetedCategoryIds.add(b.category_id)
  }

  // 2. Index categories by id for fast name lookup.
  const categoryById = new Map<string, { id: string; name: string }>()
  for (const c of categories) {
    categoryById.set(c.id, { id: c.id, name: c.name })
  }

  // 3. Walk bills, filter for orphans.
  const orphans: OrphanBill[] = []
  for (const bill of bills) {
    if (bill.is_active !== true) continue
    const cid = bill.budget_category_id
    if (cid == null) continue
    if (budgetedCategoryIds.has(cid)) continue
    // Defensive: if the bill points at a category that no longer exists in
    // the categories list, skip it — we can't render a name.
    const category = categoryById.get(cid)
    if (!category) continue
    orphans.push({ bill, category })
  }

  // 4. Biggest commitments first.
  return orphans.slice().sort((a, b) => b.bill.budget_amount - a.bill.budget_amount)
}
