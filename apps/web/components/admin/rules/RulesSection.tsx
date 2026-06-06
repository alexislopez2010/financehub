'use client'

import { useMemo } from 'react'
import { useBillMatchRules, type BillMatchRuleRow } from '@/lib/data/billMatchRules'
import { useBills, type BillRow } from '@/lib/data/bills'
import { useCategories, type CategoryRow } from '@/lib/data/categories'
import { RuleRow } from './RuleRow'
import { AddRuleForm } from './AddRuleForm'

const NO_CATEGORY = '(no category)'

interface RuleWithBill {
  readonly rule: BillMatchRuleRow
  /** The bill this rule links to via bill_id or bill_name, if any. */
  readonly bill: BillRow | null
}

interface CategoryGroup {
  readonly category: string
  readonly rules: ReadonlyArray<RuleWithBill>
  /**
   * True when the category exists in the categories table (i.e., it's a real
   * household category, not a free-form text used only on rules). Drives the
   * "empty real category" hint and the AddRuleForm visibility.
   */
  readonly isKnownCategory: boolean
}

/**
 * Resolves the effective category for a rule.
 *   1. rule.category — direct map
 *   2. rule.bill_id  → bill.category — indirect via bill
 *   3. rule.bill_name → bill.category — indirect via name lookup
 *   4. NO_CATEGORY otherwise
 */
function effectiveCategoryFor(
  rule: BillMatchRuleRow,
  billById: ReadonlyMap<string, BillRow>,
  billByName: ReadonlyMap<string, BillRow>
): { category: string; bill: BillRow | null } {
  // First find any linked bill so it can ride along as a chip even when the
  // rule has its own explicit category.
  let bill: BillRow | null = null
  if (rule.bill_id) bill = billById.get(rule.bill_id) ?? null
  if (!bill && rule.bill_name) {
    bill = billByName.get(rule.bill_name.trim().toLowerCase()) ?? null
  }
  if (rule.category) return { category: rule.category, bill }
  if (bill?.category) return { category: bill.category, bill }
  return { category: NO_CATEGORY, bill }
}

function groupRulesByCategory(
  bills: ReadonlyArray<BillRow>,
  rules: ReadonlyArray<BillMatchRuleRow>,
  categories: ReadonlyArray<CategoryRow>
): ReadonlyArray<CategoryGroup> {
  const billById   = new Map(bills.map(b => [b.id, b]))
  const billByName = new Map(bills.map(b => [b.name.trim().toLowerCase(), b]))

  // Seed the map with every expense category from the categories table so the
  // user sees ALL real categories, including ones with no rules yet.
  const byCategory = new Map<string, RuleWithBill[]>()
  const knownCategoryNames = new Set<string>()
  for (const c of categories) {
    if (c.type !== 'expense') continue
    byCategory.set(c.name, [])
    knownCategoryNames.add(c.name)
  }

  for (const rule of rules) {
    const { category, bill } = effectiveCategoryFor(rule, billById, billByName)
    let arr = byCategory.get(category)
    if (!arr) {
      arr = []
      byCategory.set(category, arr)
    }
    arr.push({ rule, bill })
  }

  // Sort rules within a category by keyword (or sub_category fallback).
  for (const arr of byCategory.values()) {
    arr.sort((a, b) => {
      const ak = a.rule.keyword ?? a.rule.sub_category ?? ''
      const bk = b.rule.keyword ?? b.rule.sub_category ?? ''
      return ak.localeCompare(bk, undefined, { sensitivity: 'base' })
    })
  }

  // Sort categories: alphabetical, NO_CATEGORY always last.
  return [...byCategory.entries()]
    .sort(([a], [b]) => {
      if (a === NO_CATEGORY) return  1
      if (b === NO_CATEGORY) return -1
      return a.localeCompare(b, undefined, { sensitivity: 'base' })
    })
    .map(([category, rulesForCat]) => ({
      category,
      rules: rulesForCat,
      isKnownCategory: knownCategoryNames.has(category)
    }))
}

export function RulesSection() {
  const rulesQ      = useBillMatchRules()
  const billsQ      = useBills()
  const categoriesQ = useCategories()

  const isLoading = rulesQ.isLoading || billsQ.isLoading || categoriesQ.isLoading
  const error     = rulesQ.error ?? billsQ.error ?? categoriesQ.error

  const groups = useMemo(
    () => groupRulesByCategory(billsQ.data ?? [], rulesQ.data ?? [], categoriesQ.data ?? []),
    [billsQ.data, rulesQ.data, categoriesQ.data]
  )
  const totalCount = rulesQ.data?.length ?? 0
  const categories = categoriesQ.data ?? []

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Match rules</h2>
          <p className="text-xs text-muted">
            {isLoading
              ? 'Loading…'
              : `${totalCount} ${totalCount === 1 ? 'rule' : 'rules'} across ${groups.length} ${groups.length === 1 ? 'category' : 'categories'}`}
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
      ) : error ? (
        <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
          Failed to load match rules: {error.message}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {groups.map(group => (
            <div key={group.category} className="py-2">
              <div className="px-4 py-2 flex items-baseline justify-between gap-2">
                <span
                  className={
                    group.category === NO_CATEGORY
                      ? 'text-xs italic uppercase tracking-wider text-red-700'
                      : 'text-xs uppercase tracking-wider font-semibold text-ink'
                  }
                >
                  {group.category}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {group.rules.length} {group.rules.length === 1 ? 'rule' : 'rules'}
                </span>
              </div>

              {group.rules.length === 0 ? (
                <p className="px-4 py-1 text-xs italic text-muted">
                  {group.isKnownCategory
                    ? `No rules yet for ${group.category}. Add one below to auto-categorize transactions.`
                    : 'Rules with no category — fix by editing each rule\'s category, then this section disappears.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {group.rules.map(({ rule, bill }) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      categories={categories}
                      linkedBill={bill}
                    />
                  ))}
                </ul>
              )}

              {group.isKnownCategory && (
                <AddRuleForm bill={null} defaultCategory={group.category} />
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
