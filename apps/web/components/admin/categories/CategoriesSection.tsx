'use client'

import { useMemo } from 'react'
import { useCategories, type CategoryRow as CategoryRowType } from '@/lib/data/categories'
import { CategoryRow } from './CategoryRow'
import { AddCategoryForm } from './AddCategoryForm'

type CategoryType = 'income' | 'expense'

interface SubGroup {
  readonly parent: string  // "(General)" when null
  readonly categories: ReadonlyArray<CategoryRowType>
}

interface TypeGroup {
  readonly type: CategoryType
  readonly label: string
  readonly subgroups: ReadonlyArray<SubGroup>
}

const GENERAL_LABEL = '(General)'

function groupCategories(rows: ReadonlyArray<CategoryRowType>): ReadonlyArray<TypeGroup> {
  const byType: Record<CategoryType, Map<string, CategoryRowType[]>> = {
    income: new Map(),
    expense: new Map()
  }

  for (const cat of rows) {
    if (cat.type !== 'income' && cat.type !== 'expense') continue
    const parentKey = cat.parent_category?.trim() || GENERAL_LABEL
    const map = byType[cat.type as CategoryType]
    const list = map.get(parentKey)
    if (list) {
      list.push(cat)
    } else {
      map.set(parentKey, [cat])
    }
  }

  function toSubgroups(map: Map<string, CategoryRowType[]>): ReadonlyArray<SubGroup> {
    const entries = Array.from(map.entries())
    // (General) first, then the rest alphabetically.
    entries.sort(([a], [b]) => {
      if (a === GENERAL_LABEL) return -1
      if (b === GENERAL_LABEL) return 1
      return a.localeCompare(b)
    })
    return entries.map(([parent, cats]) => ({
      parent,
      categories: [...cats].sort((x, y) => x.name.localeCompare(y.name))
    }))
  }

  return [
    { type: 'income', label: 'Income', subgroups: toSubgroups(byType.income) },
    { type: 'expense', label: 'Expense', subgroups: toSubgroups(byType.expense) }
  ]
}

export function CategoriesSection() {
  const categoriesQ = useCategories()

  const groups = useMemo(
    () => groupCategories(categoriesQ.data ?? []),
    [categoriesQ.data]
  )
  const totalCount = categoriesQ.data?.length ?? 0

  return (
    <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
      <header className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-ink">Categories</h2>
          <p className="text-xs text-muted">
            {categoriesQ.isLoading
              ? 'Loading…'
              : `${totalCount} ${totalCount === 1 ? 'category' : 'categories'}`}
          </p>
        </div>
      </header>

      {categoriesQ.isLoading ? (
        <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
      ) : categoriesQ.error ? (
        <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
          Failed to load categories: {categoriesQ.error.message}
        </div>
      ) : totalCount === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted">No categories yet.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {groups.map((group) => {
            if (group.subgroups.length === 0) return null
            return (
              <div key={group.type} className="py-2">
                <div className="px-4 py-2 text-xs italic uppercase tracking-wider text-muted">
                  {group.label}
                </div>
                {group.subgroups.map((sub) => (
                  <div key={`${group.type}:${sub.parent}`} className="pb-1">
                    <div className="px-4 py-1 text-[11px] italic uppercase tracking-wider text-muted/80">
                      {sub.parent}
                    </div>
                    <ul className="divide-y divide-gray-50">
                      {sub.categories.map((cat) => (
                        <CategoryRow key={cat.id} category={cat} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      <AddCategoryForm />
    </section>
  )
}
