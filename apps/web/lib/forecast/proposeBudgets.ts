/**
 * Turn projections into per-category budget proposals for one target month.
 * The Forecast propose-and-apply panel renders these (proposed vs current);
 * applying writes proposed → budgets.amount for (category, targetYear, targetMonth).
 */

import type { BillProjection } from './project'
import { round2 } from './utils'

export interface CurrentBudget {
  category: string
  amount: number
}

export interface BudgetProposal {
  category: string
  /** Sum of projected amounts mapping to this category for the target month. */
  proposed: number
  /** Existing budgets.amount for this category, or 0 if none. */
  current: number
  /** proposed - current. Positive = budget should rise. */
  delta: number
}

export interface ProposeBudgetsInput {
  projections: ReadonlyArray<BillProjection>
  currentBudgets: ReadonlyArray<CurrentBudget>
  targetYear: number
  targetMonth: number
}

export function proposeBudgets(input: ProposeBudgetsInput): ReadonlyArray<BudgetProposal> {
  const { projections, currentBudgets, targetYear, targetMonth } = input

  // Sum projected amounts per category for the target month.
  const proposedByCategory = new Map<string, number>()
  for (const proj of projections) {
    if (!proj.category) continue
    const cell = proj.months.find(m => m.year === targetYear && m.month === targetMonth)
    if (!cell) continue
    proposedByCategory.set(proj.category, round2((proposedByCategory.get(proj.category) ?? 0) + cell.amount))
  }

  const currentByCategory = new Map<string, number>()
  for (const b of currentBudgets) {
    currentByCategory.set(b.category, (currentByCategory.get(b.category) ?? 0) + b.amount)
  }

  const rows: BudgetProposal[] = []
  for (const [category, proposed] of proposedByCategory.entries()) {
    const current = currentByCategory.get(category) ?? 0
    rows.push({ category, proposed: round2(proposed), current: round2(current), delta: round2(proposed - current) })
  }
  rows.sort((a, b) => a.category.localeCompare(b.category, undefined, { sensitivity: 'base' }))
  return rows
}
