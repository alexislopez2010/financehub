/**
 * Maps raw DB rows (bills + categories) into the Phase 1 projection engine's
 * inputs. Each active bill becomes a ProjectBill with its tier resolved
 * (bill override → category override → auto heuristic) and its seasonal_profile
 * parsed. Expense categories that resolve to the discretionary tier and aren't
 * already covered by a bill become discretionary lines the engine trend-projects.
 *
 * Pure — the Forecast surface fetches the rows; this glue keeps the surface
 * component free of DB-shape concerns.
 */

import type { Tables } from '@/lib/supabase/database.types'
import { resolveTier, isSpendTier } from './tier'
import { parseSeasonalProfile } from './seasonalProfile'
import type { ProjectBill, DiscretionaryCategory } from './project'

type BillRow = Tables<'bills'>
type CategoryRow = Tables<'categories'>

export interface BuildProjectInputsArgs {
  bills: ReadonlyArray<BillRow>
  categories: ReadonlyArray<CategoryRow>
}

export interface ProjectInputs {
  bills: ReadonlyArray<ProjectBill>
  discretionaryCategories: ReadonlyArray<DiscretionaryCategory>
}

export function buildProjectInputs(args: BuildProjectInputsArgs): ProjectInputs {
  const catByName = new Map<string, CategoryRow>()
  for (const c of args.categories) catByName.set(c.name.trim().toLowerCase(), c)

  const billedCategoryNames = new Set<string>()
  const bills: ProjectBill[] = []

  for (const b of args.bills) {
    if (b.is_active === false) continue
    const cat = b.category ? catByName.get(b.category.trim().toLowerCase()) : undefined
    const tier = resolveTier({
      billTier: isSpendTier(b.tier) ? b.tier : null,
      categoryTier: cat && isSpendTier(cat.tier) ? cat.tier : null,
      isFixed: cat?.is_fixed ?? null,
      hasLinkedDebt: b.linked_debt_id != null,
      hasBill: true
    })
    if (b.category) billedCategoryNames.add(b.category.trim().toLowerCase())
    bills.push({
      id: b.id,
      name: b.name,
      tier,
      category: b.category,
      budgetAmount: b.budget_amount,
      isFixed: cat?.is_fixed === true,
      seasonalProfile: parseSeasonalProfile(b.seasonal_profile)
    })
  }

  // Discretionary categories: expense categories that resolve to the
  // discretionary tier and aren't already represented by a bill.
  const discretionaryCategories: DiscretionaryCategory[] = []
  for (const c of args.categories) {
    if (c.type !== 'expense') continue
    if (billedCategoryNames.has(c.name.trim().toLowerCase())) continue
    const tier = resolveTier({
      billTier: null,
      categoryTier: isSpendTier(c.tier) ? c.tier : null,
      isFixed: c.is_fixed ?? null,
      hasLinkedDebt: false,
      hasBill: false
    })
    if (tier === 'discretionary') discretionaryCategories.push({ name: c.name })
  }

  return { bills, discretionaryCategories }
}
