'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useMemo, useState } from 'react'
import { X, Sparkles, Wand2, ListChecks, HelpCircle } from 'lucide-react'
import { useTransactions, useUpdateTransaction, type TransactionRow } from '@/lib/data/transactions'
import { useCategories, type CategoryRow } from '@/lib/data/categories'
import { useBillMatchRules } from '@/lib/data/billMatchRules'
import { useBills } from '@/lib/data/bills'
import { suggestCategories, type MerchantGroup } from '@/lib/ledger/autoCategorize'
import { KpiTile } from '@/components/ui/KpiTile'
import { cn } from '@/lib/cn'

export interface AutoCategorizeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface GroupChoice {
  /** Whether this group is included in the Apply pass. */
  selected: boolean
  /** Chosen category id; null = "(no change)". */
  categoryId: string | null
}

interface ApplyProgress {
  done: number
  total: number
}

interface ApplySummary {
  applied: number
  failed: number
  groupCount: number
}

/** Truncate descriptions for display in the merchant table. */
function truncate(s: string, max = 60): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

function formatSampleLine(samples: ReadonlyArray<string>): string {
  if (samples.length === 0) return ''
  const first = truncate(samples[0] ?? '')
  if (samples.length === 1) return first
  return `${first} +${samples.length - 1} more`
}

interface ConfidencePillProps {
  confidence: MerchantGroup['confidence']
}

function ConfidencePill({ confidence }: ConfidencePillProps) {
  if (confidence === 'bill' || confidence === 'rule') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
        High
      </span>
    )
  }
  if (confidence === 'learned' || confidence === 'dictionary') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
        Med
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
      ?
    </span>
  )
}

export function AutoCategorizeDialog({ open, onOpenChange }: AutoCategorizeDialogProps) {
  const txQ = useTransactions()
  const categoriesQ = useCategories()
  const rulesQ = useBillMatchRules()
  const billsQ = useBills()
  const updateTx = useUpdateTransaction()

  const txs: ReadonlyArray<TransactionRow> = txQ.data ?? []
  const categories: ReadonlyArray<CategoryRow> = categoriesQ.data ?? []

  // Transfers don't carry a spending category — they're money moving
  // between accounts, not spend — so exclude them from the
  // "needs categorization" pool. Otherwise auto-categorize would suggest
  // spending categories for paydowns, savings transfers, etc.
  const uncategorized = useMemo(
    () => txs.filter(t => !t.category_id && !t.category && t.type !== 'Transfer'),
    [txs]
  )
  const categorized = useMemo(
    () => txs.filter(t => (t.category ?? '').trim().length > 0),
    [txs]
  )

  const groups = useMemo<ReadonlyArray<MerchantGroup>>(() => {
    if (!categoriesQ.data || !rulesQ.data) return []
    return suggestCategories({
      uncategorizedTxs: uncategorized.map(t => ({
        id: t.id,
        description: t.description ?? ''
      })),
      categorizedTxs: categorized.map(t => ({
        description: t.description ?? '',
        category: t.category
      })),
      billMatchRules: (rulesQ.data ?? []).map(r => ({
        bill_id: r.bill_id,
        name_keyword: r.keyword,
        category: r.category
      })),
      bills: (billsQ.data ?? []).map(b => ({
        id: b.id,
        budget_category_id: b.budget_category_id
      })),
      categories: categories.map(c => ({ id: c.id, name: c.name }))
    })
  }, [uncategorized, categorized, categoriesQ.data, rulesQ.data, billsQ.data, categories])

  // Per-group user choice keyed by normalized merchant.
  const [groupChoices, setGroupChoices] = useState<Record<string, GroupChoice>>({})
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState<ApplyProgress>({ done: 0, total: 0 })
  const [summary, setSummary] = useState<ApplySummary | null>(null)

  // (Re)initialize choices whenever the set of groups changes shape.
  // We key the effect by the merchant list so reopening the dialog with a
  // refreshed cache re-seeds defaults instead of holding stale state.
  const merchantKey = groups.map(g => g.merchant).join('|')
  useEffect(() => {
    const next: Record<string, GroupChoice> = {}
    for (const g of groups) {
      next[g.merchant] = {
        selected: g.confidence !== 'none' && g.suggestedCategoryId !== null,
        categoryId: g.suggestedCategoryId
      }
    }
    setGroupChoices(next)
    setSummary(null)
  }, [merchantKey, groups])

  // Reset transient state on dialog close.
  useEffect(() => {
    if (!open) {
      setApplying(false)
      setProgress({ done: 0, total: 0 })
      setSummary(null)
    }
  }, [open])

  const isLoading = txQ.isLoading || categoriesQ.isLoading || rulesQ.isLoading || billsQ.isLoading

  // Derived counts.
  const haveSuggestionCount = groups.filter(g => g.confidence !== 'none').length
  const noSuggestionCount = groups.filter(g => g.confidence === 'none').length
  const selectedGroups = groups.filter(g => {
    const c = groupChoices[g.merchant]
    return c?.selected === true && c.categoryId !== null
  })
  const selectedTxCount = selectedGroups.reduce((sum, g) => sum + g.txIds.length, 0)

  function toggleSelected(merchant: string, nextSelected: boolean): void {
    setGroupChoices(prev => {
      const cur = prev[merchant]
      if (!cur) return prev
      return { ...prev, [merchant]: { ...cur, selected: nextSelected } }
    })
  }

  function changeCategory(merchant: string, nextId: string | null): void {
    setGroupChoices(prev => {
      const cur = prev[merchant]
      if (!cur) return prev
      // If user picks "(no change)" while group was selected, deselect.
      const nextSelected = nextId === null ? false : cur.selected
      return { ...prev, [merchant]: { selected: nextSelected, categoryId: nextId } }
    })
  }

  async function handleApply(): Promise<void> {
    if (selectedTxCount === 0 || applying) return

    setApplying(true)
    setProgress({ done: 0, total: selectedTxCount })

    let applied = 0
    let failed = 0
    const groupCount = selectedGroups.length

    // Sequential per-row updates for clear progress UX. Mirror
    // handleBulkAssignCategory: write BOTH category_id AND category text.
    for (const group of selectedGroups) {
      const choice = groupChoices[group.merchant]
      if (!choice || choice.categoryId === null) continue
      const categoryName = categories.find(c => c.id === choice.categoryId)?.name ?? null
      for (const txId of group.txIds) {
        try {
          await updateTx.mutateAsync({
            id: txId,
            patch: { category_id: choice.categoryId, category: categoryName }
          })
          applied += 1
        } catch {
          failed += 1
        }
        setProgress(p => ({ ...p, done: p.done + 1 }))
      }
    }

    setApplying(false)
    setSummary({ applied, failed, groupCount })

    // Auto-close after a brief success display.
    window.setTimeout(() => {
      onOpenChange(false)
    }, 1500)
  }

  const applyDisabled = applying || selectedTxCount === 0 || isLoading

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
              <Sparkles size={16} className="text-brand" />
              <Dialog.Title className="text-sm font-semibold text-ink">
                Auto-categorize transactions
              </Dialog.Title>
            </div>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <Dialog.Description className="text-xs text-muted">
              {uncategorized.length} uncategorized rows · {groups.length} merchants. Suggestions
              seeded from your bills, bill rules, history, and built-in patterns.
              Already-categorized rows are never touched.
            </Dialog.Description>

            {isLoading ? (
              <div className="rounded-xl border border-rule bg-bg p-6 text-center text-sm text-muted">
                Analyzing transactions…
              </div>
            ) : groups.length === 0 ? (
              <div className="rounded-xl border border-rule bg-bg p-6 text-center text-sm text-muted">
                Nothing to do — every transaction already has a category.
              </div>
            ) : (
              <>
                {/* Summary tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiTile
                    label="Have suggestion"
                    value={String(haveSuggestionCount)}
                    icon={Sparkles}
                    iconTone="emerald"
                  />
                  <KpiTile
                    label="No suggestion"
                    value={String(noSuggestionCount)}
                    icon={HelpCircle}
                    iconTone="gray"
                  />
                  <KpiTile
                    label="Selected to apply"
                    value={String(selectedTxCount)}
                    {...(selectedGroups.length > 0
                      ? { caption: `${selectedGroups.length} merchant${selectedGroups.length === 1 ? '' : 's'}` }
                      : {})}
                    icon={ListChecks}
                    iconTone="purple"
                  />
                </div>

                {/* Groups table */}
                <section
                  aria-label="Merchant groups"
                  className="rounded-xl border border-rule overflow-hidden"
                >
                  {/* Horizontal scroll so the dense 5-column grid doesn't clip
                      inside the dialog on narrow phones (the grid is ~520px). */}
                  <div className="overflow-x-auto">
                  <div className="min-w-[520px]">
                  <header className="grid grid-cols-[24px_1fr_60px_50px_180px] gap-2 px-3 py-2 bg-bg text-[10px] font-semibold uppercase tracking-wider text-muted">
                    <span aria-hidden="true" />
                    <span>Merchant</span>
                    <span className="text-right">Txs</span>
                    <span className="text-center">Conf.</span>
                    <span>Category</span>
                  </header>
                  <ul className="divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
                    {groups.map(group => {
                      const choice = groupChoices[group.merchant] ?? {
                        selected: false,
                        categoryId: null
                      }
                      return (
                        <li
                          key={group.merchant}
                          className="grid grid-cols-[24px_1fr_60px_50px_180px] gap-2 items-center px-3 py-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            aria-label={`Include ${group.merchant} in apply`}
                            checked={choice.selected}
                            disabled={applying || choice.categoryId === null}
                            onChange={e => toggleSelected(group.merchant, e.target.checked)}
                            className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-ink truncate" title={group.merchant}>
                              {group.merchant}
                            </div>
                            <div className="text-xs text-muted truncate">
                              {formatSampleLine(group.sampleDescriptions)}
                            </div>
                          </div>
                          <div className="text-right tabular text-xs text-muted">
                            {group.txIds.length}
                          </div>
                          <div className="flex justify-center">
                            <ConfidencePill confidence={group.confidence} />
                          </div>
                          <div>
                            <select
                              aria-label={`Category for ${group.merchant}`}
                              value={choice.categoryId ?? ''}
                              disabled={applying}
                              onChange={e => changeCategory(
                                group.merchant,
                                e.target.value === '' ? null : e.target.value
                              )}
                              className={cn(
                                'w-full rounded-md border border-rule bg-surface px-2 py-1 text-xs text-ink',
                                'disabled:opacity-60'
                              )}
                            >
                              <option value="">(no change)</option>
                              {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  </div>
                  </div>
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-surface border-t border-rule px-5 py-3 space-y-2">
            {applying && progress.total > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Applying {progress.done} of {progress.total}…</span>
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
            {summary && !applying && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
              >
                Categorized {summary.applied} transaction{summary.applied === 1 ? '' : 's'} across {summary.groupCount} merchant{summary.groupCount === 1 ? '' : 's'}
                {summary.failed > 0 ? ` (${summary.failed} failed)` : ''}.
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Will categorize <span className="font-semibold text-ink">{selectedTxCount}</span> transaction{selectedTxCount === 1 ? '' : 's'} in <span className="font-semibold text-ink">{selectedGroups.length}</span> group{selectedGroups.length === 1 ? '' : 's'}.
              </p>
              <div className="flex items-center gap-2">
                <Dialog.Close
                  disabled={applying}
                  className="px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-60"
                >
                  {summary ? 'Done' : 'Cancel'}
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applyDisabled}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
                    'bg-brand text-white hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed'
                  )}
                >
                  <Wand2 size={14} aria-hidden="true" />
                  {applying ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
