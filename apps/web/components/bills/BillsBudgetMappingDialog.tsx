'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState } from 'react'
import { X, Layers, Save } from 'lucide-react'
import { useBills, useUpdateBill, type BillRow } from '@/lib/data/bills'
import { useCategories, type CategoryRow } from '@/lib/data/categories'
import { suggestBudgetCategoryId } from '@/lib/bills/suggestBudgetCategory'
import { cn } from '@/lib/cn'

export interface BillsBudgetMappingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SaveProgress {
  done: number
  total: number
}

interface SaveSummary {
  saved: number
  failed: number
}

/**
 * Bulk-mapping UI for `bills.budget_category_id`.
 *
 * Shows every active bill in a scrollable table with a Budget Category
 * dropdown. Each row is pre-selected with either:
 *   - the bill's current `budget_category_id` (if already mapped), OR
 *   - the suggestion from `suggestBudgetCategoryId()` (if unmapped).
 *
 * The user confirms/overrides each row and clicks Save. Only rows where the
 * selection differs from the saved value are written, via per-row
 * `useUpdateBill` mutations in a Promise.allSettled loop with progress.
 */
export function BillsBudgetMappingDialog({ open, onOpenChange }: BillsBudgetMappingDialogProps) {
  const billsQ = useBills()
  const categoriesQ = useCategories()
  const updateBill = useUpdateBill()

  const bills: ReadonlyArray<BillRow> = billsQ.data ?? []
  const categories: ReadonlyArray<CategoryRow> = categoriesQ.data ?? []

  // Only active bills are eligible for mapping in the bulk UI.
  const eligibleBills = useMemo(
    () => bills.filter(b => b.is_active !== false),
    [bills]
  )

  // Baseline (saved) selection per bill — used to detect "changed" rows.
  const baselineByBillId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const b of eligibleBills) m.set(b.id, b.budget_category_id ?? null)
    return m
  }, [eligibleBills])

  // Local draft selection per bill. Initialized to baseline OR suggestion.
  const [selections, setSelections] = useState<Record<string, string | null>>({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<SaveProgress>({ done: 0, total: 0 })
  const [summary, setSummary] = useState<SaveSummary | null>(null)

  // (Re)seed selections whenever the bills list changes shape.
  const billsKey = eligibleBills.map(b => b.id).join('|')
  useEffect(() => {
    const next: Record<string, string | null> = {}
    for (const b of eligibleBills) {
      if (b.budget_category_id) {
        next[b.id] = b.budget_category_id
      } else {
        next[b.id] = suggestBudgetCategoryId(
          { name: b.name, category: b.category },
          categories.map(c => ({ id: c.id, name: c.name }))
        )
      }
    }
    setSelections(next)
    setSummary(null)
    // billsKey covers content; categories key keeps suggestions in sync if
    // categories load after bills.
  }, [billsKey, eligibleBills, categories])

  // Reset transient state on close.
  useEffect(() => {
    if (!open) {
      setSaving(false)
      setProgress({ done: 0, total: 0 })
      setSummary(null)
    }
  }, [open])

  const isLoading = billsQ.isLoading || categoriesQ.isLoading

  // Rows whose draft selection differs from baseline.
  const changedBillIds = useMemo<ReadonlyArray<string>>(() => {
    const out: string[] = []
    for (const b of eligibleBills) {
      const draft = selections[b.id] ?? null
      const baseline = baselineByBillId.get(b.id) ?? null
      if (draft !== baseline) out.push(b.id)
    }
    return out
  }, [eligibleBills, selections, baselineByBillId])

  const changedCount = changedBillIds.length

  function changeSelection(billId: string, nextId: string | null): void {
    setSelections(prev => ({ ...prev, [billId]: nextId }))
  }

  async function handleSave(): Promise<void> {
    if (changedCount === 0 || saving) return

    setSaving(true)
    setProgress({ done: 0, total: changedCount })

    const settlements = await Promise.allSettled(
      changedBillIds.map(async id => {
        try {
          await updateBill.mutateAsync({
            id,
            patch: { budget_category_id: selections[id] ?? null }
          })
        } finally {
          setProgress(p => ({ ...p, done: p.done + 1 }))
        }
      })
    )

    const saved = settlements.filter(s => s.status === 'fulfilled').length
    const failed = settlements.length - saved

    setSaving(false)
    setSummary({ saved, failed })

    if (failed === 0) {
      window.setTimeout(() => onOpenChange(false), 1200)
    }
  }

  const saveDisabled = saving || changedCount === 0 || isLoading
  const unmappedCount = eligibleBills.filter(b => !b.budget_category_id).length

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[94vw] max-w-3xl max-h-[88vh] overflow-hidden flex flex-col',
            'rounded-2xl bg-surface shadow-2xl'
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-brand" />
              <Dialog.Title className="text-sm font-semibold text-ink">
                Map bills → budget categories
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <Dialog.Description className="text-xs text-muted">
              Pick the budget category each bill should roll up to. Suggestions
              are pre-filled from the bill&apos;s name &amp; category text — confirm
              or override per row, then Save. <span className="font-semibold text-ink">{unmappedCount}</span> of <span className="font-semibold text-ink">{eligibleBills.length}</span> currently unmapped.
            </Dialog.Description>

            {isLoading ? (
              <div className="rounded-xl border border-rule bg-bg p-6 text-center text-sm text-muted">
                Loading bills…
              </div>
            ) : eligibleBills.length === 0 ? (
              <div className="rounded-xl border border-rule bg-bg p-6 text-center text-sm text-muted">
                No active bills to map.
              </div>
            ) : (
              <section
                aria-label="Bill → budget category mapping"
                className="rounded-xl border border-rule overflow-hidden"
              >
                <header className="grid grid-cols-[1fr_220px] gap-3 px-3 py-2 bg-bg text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <span>Bill</span>
                  <span>Budget category</span>
                </header>
                <ul className="divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
                  {eligibleBills.map(bill => {
                    const draft = selections[bill.id] ?? null
                    const baseline = baselineByBillId.get(bill.id) ?? null
                    const changed = draft !== baseline
                    return (
                      <li
                        key={bill.id}
                        className={cn(
                          'grid grid-cols-[1fr_220px] gap-3 items-center px-3 py-2 text-sm',
                          changed && 'bg-blue-50/40'
                        )}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-ink truncate" title={bill.name}>
                            {bill.name}
                          </div>
                          {bill.category && (
                            <div className="text-xs text-muted truncate">
                              {bill.category}
                            </div>
                          )}
                        </div>
                        <div>
                          <select
                            aria-label={`Budget category for ${bill.name}`}
                            value={draft ?? ''}
                            disabled={saving}
                            onChange={e => changeSelection(
                              bill.id,
                              e.target.value === '' ? null : e.target.value
                            )}
                            className={cn(
                              'w-full rounded-md border border-rule bg-surface px-2 py-1 text-xs text-ink',
                              'disabled:opacity-60'
                            )}
                          >
                            <option value="">(none)</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-surface border-t border-rule px-5 py-3 space-y-2">
            {saving && progress.total > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Saving {progress.done} of {progress.total}…</span>
                  <span>{Math.round((progress.done / progress.total) * 100)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full bg-brand transition-[width] duration-150"
                    style={{ width: `${(progress.done / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {summary && !saving && (
              <div
                role="status"
                className={cn(
                  'rounded-lg border px-3 py-2 text-xs',
                  summary.failed === 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                )}
              >
                Saved {summary.saved} bill{summary.saved === 1 ? '' : 's'}
                {summary.failed > 0 ? ` (${summary.failed} failed)` : ''}.
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                <span className="font-semibold text-ink">{changedCount}</span> change{changedCount === 1 ? '' : 's'} pending.
              </p>
              <div className="flex items-center gap-2">
                <Dialog.Close
                  disabled={saving}
                  className="px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-60"
                >
                  {summary && summary.failed === 0 ? 'Done' : 'Cancel'}
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saveDisabled}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    'bg-brand text-white hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed'
                  )}
                >
                  <Save size={14} aria-hidden="true" />
                  {saving ? 'Saving…' : `Save ${changedCount} change${changedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
