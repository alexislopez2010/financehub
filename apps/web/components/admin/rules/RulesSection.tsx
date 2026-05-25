'use client'

import { useMemo } from 'react'
import { useBillMatchRules, type BillMatchRuleRow } from '@/lib/data/billMatchRules'
import { useBills, type BillRow } from '@/lib/data/bills'
import { useCategories } from '@/lib/data/categories'
import { RuleRow } from './RuleRow'
import { AddRuleForm } from './AddRuleForm'

interface BillGroup {
  readonly bill: BillRow
  readonly rules: ReadonlyArray<BillMatchRuleRow>
}

interface RulesGrouped {
  readonly bills: ReadonlyArray<BillGroup>
  readonly general: ReadonlyArray<BillMatchRuleRow>
}

function groupRules(
  bills: ReadonlyArray<BillRow>,
  rules: ReadonlyArray<BillMatchRuleRow>
): RulesGrouped {
  // Only show active bills as their own groups.
  const activeBills = bills.filter(b => b.is_active !== false)
  const sortedBills = [...activeBills].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )

  function sortByKeyword(rs: ReadonlyArray<BillMatchRuleRow>): ReadonlyArray<BillMatchRuleRow> {
    return [...rs].sort((a, b) =>
      (a.keyword ?? '').localeCompare(b.keyword ?? '', undefined, { sensitivity: 'base' })
    )
  }

  const billGroups: BillGroup[] = sortedBills.map(bill => {
    const billRules = rules.filter(
      r => r.bill_id === bill.id || (r.bill_id == null && r.bill_name === bill.name)
    )
    return { bill, rules: sortByKeyword(billRules) }
  })

  // General rules: bill_id null AND no bill_name match against any known bill.
  const billNames = new Set(bills.map(b => b.name))
  const general = sortByKeyword(
    rules.filter(r => r.bill_id == null && (r.bill_name == null || !billNames.has(r.bill_name)))
  )

  return { bills: billGroups, general }
}

export function RulesSection() {
  const rulesQ = useBillMatchRules()
  const billsQ = useBills()
  const categoriesQ = useCategories()

  const isLoading = rulesQ.isLoading || billsQ.isLoading || categoriesQ.isLoading
  const error = rulesQ.error ?? billsQ.error ?? categoriesQ.error

  const grouped = useMemo(
    () => groupRules(billsQ.data ?? [], rulesQ.data ?? []),
    [billsQ.data, rulesQ.data]
  )
  const totalCount = rulesQ.data?.length ?? 0
  const categories = categoriesQ.data ?? []

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Bill match rules</h2>
          <p className="text-xs text-muted">
            {isLoading
              ? 'Loading…'
              : `${totalCount} ${totalCount === 1 ? 'rule' : 'rules'}`}
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
          {grouped.bills.map(group => (
            <div key={group.bill.id} className="py-2">
              <div className="px-4 py-2 flex items-baseline gap-2">
                <span className="text-xs italic uppercase tracking-wider text-muted">
                  {group.bill.name}
                </span>
                {group.bill.frequency && (
                  <span className="text-[10px] uppercase tracking-wider text-muted/60">
                    · {group.bill.frequency}
                  </span>
                )}
              </div>
              {group.rules.length === 0 ? (
                <p className="px-4 py-1 text-xs text-muted">
                  No rules — transactions matching this bill must be detected manually.
                </p>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {group.rules.map(rule => (
                    <RuleRow key={rule.id} rule={rule} categories={categories} />
                  ))}
                </ul>
              )}
              <AddRuleForm bill={group.bill} />
            </div>
          ))}

          <div className="py-2">
            <div className="px-4 py-2 text-xs italic uppercase tracking-wider text-muted">
              General rules
            </div>
            {grouped.general.length === 0 ? (
              <p className="px-4 py-1 text-xs text-muted">
                No general rules — use these to tag transactions that don&rsquo;t belong to a specific bill.
              </p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {grouped.general.map(rule => (
                  <RuleRow key={rule.id} rule={rule} categories={categories} />
                ))}
              </ul>
            )}
            <AddRuleForm bill={null} />
          </div>
        </div>
      )}
    </section>
  )
}
