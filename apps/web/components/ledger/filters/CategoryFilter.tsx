'use client'

import { useMemo, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { useCategories } from '@/lib/data/categories'
import { cn } from '@/lib/cn'

export interface CategoryFilterProps {
  /**
   * undefined → filter not set
   * null      → explicitly filter to Uncategorized
   * string    → category id
   */
  value: string | null | undefined
  onChange: (next: string | null | undefined) => void
}

interface CategoryItem {
  id: string
  name: string
  type?: string | null
}

const SEARCH_THRESHOLD = 15
const SECTION_LABEL_CLASS = 'px-3 py-1.5 text-xs uppercase tracking-wider text-muted'

export function CategoryFilter({ value, onChange }: CategoryFilterProps) {
  const categoriesQ = useCategories()
  const categories = categoriesQ.data ?? []
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return categories
    const q = query.trim().toLowerCase()
    return categories.filter(c => c.name.toLowerCase().includes(q))
  }, [categories, query])

  const grouped = useMemo(() => {
    const expense: CategoryItem[] = []
    const income: CategoryItem[] = []
    for (const c of filtered) {
      if (c.type === 'income') income.push(c)
      else expense.push(c)
    }
    const byName = (a: CategoryItem, b: CategoryItem) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    expense.sort(byName)
    income.sort(byName)
    return { expense, income }
  }, [filtered])

  const showSearch = categories.length > SEARCH_THRESHOLD

  if (value !== undefined) {
    const display =
      value === null
        ? 'Uncategorized'
        : categories.find(c => c.id === value)?.name ?? value.slice(0, 8)

    return (
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-label={`Clear category filter (${display})`}
        className={cn(
          'inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs',
          'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
        )}
      >
        <span className="font-medium">category:</span>
        <span>{display}</span>
        <X size={12} className="ml-1" />
      </button>
    )
  }

  return (
    <DropdownMenu.Root
      onOpenChange={open => {
        if (!open) setQuery('')
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Filter by category"
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-2 py-1 rounded-full text-xs',
            'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
          )}
        >
          <span className="font-medium">Category</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[220px] max-h-[360px] overflow-y-auto rounded-lg bg-surface border border-rule shadow-lg p-1',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0'
          )}
        >
          {showSearch && (
            <div className="p-1.5">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                placeholder="Search categories…"
                aria-label="Search categories"
                className={cn(
                  'w-full px-2.5 py-1 text-xs rounded-md',
                  'bg-bg border border-rule text-ink',
                  'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/20'
                )}
              />
            </div>
          )}

          <DropdownMenu.Item
            onSelect={() => onChange(null)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none italic"
          >
            Uncategorized
          </DropdownMenu.Item>

          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">No matches</div>
          ) : (
            <>
              {grouped.expense.length > 0 && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-rule" />
                  <DropdownMenu.Label className={SECTION_LABEL_CLASS}>
                    Expense
                  </DropdownMenu.Label>
                  {grouped.expense.map(c => (
                    <DropdownMenu.Item
                      key={c.id}
                      onSelect={() => onChange(c.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
                    >
                      {c.name}
                    </DropdownMenu.Item>
                  ))}
                </>
              )}
              {grouped.income.length > 0 && (
                <>
                  <DropdownMenu.Separator className="my-1 h-px bg-rule" />
                  <DropdownMenu.Label className={SECTION_LABEL_CLASS}>
                    Income
                  </DropdownMenu.Label>
                  {grouped.income.map(c => (
                    <DropdownMenu.Item
                      key={c.id}
                      onSelect={() => onChange(c.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
                    >
                      {c.name}
                    </DropdownMenu.Item>
                  ))}
                </>
              )}
            </>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
