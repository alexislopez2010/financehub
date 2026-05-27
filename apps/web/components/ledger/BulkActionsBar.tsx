'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Tag, Trash2, UserSquare2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useDeleteTransaction } from '@/lib/data/transactions'
import { buildMemberOptions } from '@/lib/ledger/memberOptions'
import { cn } from '@/lib/cn'

interface CategoryOption {
  id: string
  name: string
  type?: string | null
}

export interface BulkActionsBarProps {
  selectedIds: ReadonlyArray<string>
  onCancel: () => void
  onCompleted: () => void
  /** Household member roster from `useHouseholdMembersList`. */
  members?: ReadonlyArray<{ display_name: string }>
  /** Apply the chosen member value to every selected row. `null` clears the assignment. */
  onAssignMember?: (member: string | null) => void | Promise<void>
  /** When true, the Assign-member button shows a loader and is disabled. */
  isAssigning?: boolean
  /** Category roster from `useCategories`. */
  categories?: ReadonlyArray<CategoryOption>
  /** Apply the chosen category to every selected row. `null` clears the assignment. */
  onAssignCategory?: (categoryId: string | null) => void | Promise<void>
  /** When true, the Assign-category button shows a loader and is disabled. */
  isAssigningCategory?: boolean
}

const SECTION_LABEL_CLASS = 'px-3 py-1.5 text-xs uppercase tracking-wider text-muted'

export function BulkActionsBar({
  selectedIds,
  onCancel,
  onCompleted,
  members,
  onAssignMember,
  isAssigning = false,
  categories,
  onAssignCategory,
  isAssigningCategory = false
}: BulkActionsBarProps) {
  const deleteTx = useDeleteTransaction()
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const grouped = useMemo(() => {
    const expense: CategoryOption[] = []
    const income: CategoryOption[] = []
    for (const c of categories ?? []) {
      if (c.type === 'income') income.push(c)
      else expense.push(c)
    }
    const byName = (a: CategoryOption, b: CategoryOption) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    expense.sort(byName)
    income.sort(byName)
    return { expense, income }
  }, [categories])

  if (selectedIds.length === 0) return null

  async function handleDelete() {
    setIsDeleting(true)
    try {
      // Per-row optimistic delete via the hook. We await all in parallel.
      await Promise.allSettled(
        selectedIds.map(id => deleteTx.mutateAsync(id))
      )
    } finally {
      setIsDeleting(false)
      setConfirming(false)
      onCompleted()
    }
  }

  const memberOptions = onAssignMember
    ? buildMemberOptions(members ?? [], [])
    : []

  return (
    <div
      role="region"
      aria-label={`${selectedIds.length} transactions selected`}
      className={cn(
        'sticky bottom-16 sm:bottom-16 z-20',
        'bg-ink text-white rounded-xl shadow-lg',
        'mx-auto max-w-md',
        'px-4 py-3 flex items-center justify-between gap-3'
      )}
    >
      <div className="text-sm font-medium tabular">
        {selectedIds.length} selected
      </div>
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setConfirming(false)}
              className="text-xs text-white/70 hover:text-white px-2 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handleDelete}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500',
                'text-white text-xs font-medium px-3 py-1.5',
                'disabled:opacity-60 disabled:cursor-not-allowed'
              )}
            >
              <Trash2 size={12} />
              {isDeleting ? 'Deleting…' : `Yes, delete ${selectedIds.length}`}
            </button>
          </>
        ) : (
          <>
            {onAssignMember && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    disabled={isAssigning}
                    aria-label="Assign member to selected rows"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg',
                      'text-white text-xs font-medium px-3 py-1.5',
                      'hover:bg-white/10',
                      'disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    <UserSquare2 size={12} />
                    {isAssigning ? 'Assigning…' : 'Assign member'}
                    <ChevronDown size={12} className="ml-0.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    collisionPadding={8}
                    className={cn(
                      'z-50 min-w-[200px] rounded-lg bg-surface border border-rule shadow-lg p-1',
                      'max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto',
                      'data-[state=open]:animate-in data-[state=open]:fade-in-0'
                    )}
                  >
                    {memberOptions.map(o => (
                      <DropdownMenu.Item
                        key={o.label}
                        onSelect={() => {
                          void onAssignMember(o.value)
                        }}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none',
                          o.kind === 'unassigned'
                            ? 'text-muted italic hover:bg-gray-100'
                            : 'text-ink hover:bg-gray-100'
                        )}
                      >
                        {o.label}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            {onAssignCategory && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    disabled={isAssigningCategory}
                    aria-label="Assign category to selected rows"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg',
                      'text-white text-xs font-medium px-3 py-1.5',
                      'hover:bg-white/10',
                      'disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    <Tag size={12} />
                    {isAssigningCategory ? 'Assigning…' : 'Assign category'}
                    <ChevronDown size={12} className="ml-0.5" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={4}
                    collisionPadding={8}
                    className={cn(
                      'z-50 min-w-[200px] rounded-lg bg-surface border border-rule shadow-lg p-1',
                      // Constrain to available viewport height + enable scroll so long
                      // category lists (Expense + Income sections) don't clip off-screen
                      // when the bulk action bar opens the menu upward.
                      'max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto',
                      'data-[state=open]:animate-in data-[state=open]:fade-in-0'
                    )}
                  >
                    <DropdownMenu.Item
                      key="__uncategorized__"
                      onSelect={() => {
                        void onAssignCategory(null)
                      }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none',
                        'text-muted italic hover:bg-gray-100'
                      )}
                    >
                      (Uncategorized)
                    </DropdownMenu.Item>
                    {grouped.expense.length > 0 && (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-rule" />
                        <DropdownMenu.Label className={SECTION_LABEL_CLASS}>
                          Expense
                        </DropdownMenu.Label>
                        {grouped.expense.map(c => (
                          <DropdownMenu.Item
                            key={c.id}
                            onSelect={() => {
                              void onAssignCategory(c.id)
                            }}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none',
                              'text-ink hover:bg-gray-100'
                            )}
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
                            onSelect={() => {
                              void onAssignCategory(c.id)
                            }}
                            className={cn(
                              'flex items-center gap-2 px-3 py-2 text-sm rounded cursor-pointer outline-none',
                              'text-ink hover:bg-gray-100'
                            )}
                          >
                            {c.name}
                          </DropdownMenu.Item>
                        ))}
                      </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg',
                'text-white text-xs font-medium px-3 py-1.5',
                'hover:bg-white/10'
              )}
            >
              <Trash2 size={12} />
              Delete
            </button>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cancel selection"
              className="text-white/70 hover:text-white p-1"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
