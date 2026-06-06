'use client'

import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Trash2, X } from 'lucide-react'
import { EditableCell, type SelectOption } from '@/components/ledger/EditableCell'
import {
  useUpdateBillMatchRule,
  useDeleteBillMatchRule,
  type BillMatchRuleRow
} from '@/lib/data/billMatchRules'
import type { CategoryRow } from '@/lib/data/categories'
import type { BillRow } from '@/lib/data/bills'
import { cn } from '@/lib/cn'

export interface RuleRowProps {
  rule: BillMatchRuleRow
  categories: ReadonlyArray<CategoryRow>
  /**
   * If the rule links to a bill (via bill_id or bill_name resolution), the
   * parent passes it in so we can surface a chip. Informational only — the
   * rule still fires via its keyword/sub_category matcher.
   */
  linkedBill?: BillRow | null
}

const UNSET_VALUE = '__unset__'

export function RuleRow({ rule, categories, linkedBill }: RuleRowProps) {
  const updateRule = useUpdateBillMatchRule()
  const deleteRule = useDeleteBillMatchRule()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const categoryOptions = useMemo<ReadonlyArray<SelectOption>>(() => {
    const opts: SelectOption[] = [{ value: UNSET_VALUE, label: '— (no category)' }]
    const sorted = [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    )
    for (const c of sorted) {
      opts.push({ value: c.name, label: c.name })
    }
    return opts
  }, [categories])

  function handleKeywordCommit(next: string) {
    const trimmed = next.trim()
    if (trimmed === (rule.keyword ?? '')) return
    if (!trimmed) {
      // The DB constraint requires a non-null keyword for name_keyword rules,
      // and an empty keyword is meaningless anyway. Surface a clear message.
      setEditError('Keyword cannot be empty')
      return
    }
    setEditError(null)
    updateRule
      .mutateAsync({ id: rule.id, patch: { keyword: trimmed } })
      .catch((err: unknown) => {
        setEditError(err instanceof Error ? err.message : 'Update failed')
      })
  }

  function handleCategoryCommit(next: string) {
    const value = next === UNSET_VALUE ? null : next
    if (value === (rule.category ?? null)) return
    if (value === null && rule.rule_kind === 'category_map') {
      setEditError('Category cannot be blank on a category_map rule.')
      return
    }
    setEditError(null)
    updateRule
      .mutateAsync({ id: rule.id, patch: { category: value } })
      .catch((err: unknown) => {
        setEditError(err instanceof Error ? err.message : 'Update failed')
      })
  }

  function handleAccountCommit(next: string) {
    const trimmed = next.trim()
    const value = trimmed || null
    if (value === (rule.account_filter ?? null)) return
    setEditError(null)
    updateRule
      .mutateAsync({ id: rule.id, patch: { account_filter: value } })
      .catch((err: unknown) => {
        setEditError(err instanceof Error ? err.message : 'Update failed')
      })
  }

  async function handleConfirmDelete() {
    setSubmitError(null)
    try {
      await deleteRule.mutateAsync(rule.id)
      setConfirmOpen(false)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to delete rule')
    }
  }

  const keywordDisplay = rule.keyword ?? ''
  const categoryDisplay = rule.category ?? ''
  const accountDisplay = rule.account_filter ?? ''

  // What the rule ACTUALLY matches on. Keyword is the primary matcher; when
  // it's null we surface sub_category so the UI doesn't pretend there's no
  // matcher (the categorize logic still uses sub_category as a substring
  // match). When BOTH are null the rule is dead — that's the only case
  // where "(no matcher)" is honest.
  const matcherFromKeyword    = Boolean(rule.keyword)
  const matcherFromSubCategory = !rule.keyword && Boolean(rule.sub_category)
  const matcherText  = rule.keyword ?? rule.sub_category ?? ''
  const matcherLabel = matcherFromKeyword    ? matcherText
                     : matcherFromSubCategory ? `sub-category: ${matcherText}`
                     : '(no matcher — rule never fires)'

  return (
    <li className="group flex flex-col gap-1 px-4 py-2.5 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <EditableCell
            variant="text"
            value={keywordDisplay}
            onCommit={handleKeywordCommit}
            placeholder="keyword"
            display={
              <span
                className={cn(
                  'truncate',
                  matcherFromKeyword     ? 'text-ink' :
                  matcherFromSubCategory ? 'text-muted'
                                          : 'text-red-600 italic'
                )}
                title={matcherFromSubCategory
                  ? `This rule matches when a transaction description contains "${matcherText}". Editing this cell sets a keyword override.`
                  : !matcherFromKeyword
                    ? 'This rule has no keyword OR sub_category — it can never fire.'
                    : undefined}
              >
                {matcherLabel}
              </span>
            }
          />
          {linkedBill && (
            <span
              className="shrink-0 inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-100"
              title={`Rule links to the "${linkedBill.name}" bill`}
            >
              → {linkedBill.name}
            </span>
          )}
        </div>

        {/*
          Match type: today every rule is substring-match ('contains'). The
          slot is here so we can expose 'exact' / 'starts_with' in a future
          pass without re-laying-out the row. Shown small + muted so it
          doesn't fight for attention now.
        */}
        <div className="text-[10px] uppercase tracking-wider text-muted whitespace-nowrap" title="Match type: substring (description contains the matcher).">
          contains
        </div>

        <div className="min-w-0">
          <EditableCell
            variant="text"
            value={accountDisplay}
            onCommit={handleAccountCommit}
            placeholder="account filter (optional)"
            display={
              <span className={cn('truncate', accountDisplay ? 'text-ink' : 'text-muted italic')}>
                {accountDisplay || '(any account)'}
              </span>
            }
          />
        </div>

        <Dialog.Root open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setSubmitError(null) }}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              aria-label={`Delete rule ${rule.keyword ?? rule.id}`}
              className="p-1 rounded text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
            <Dialog.Content className={cn(
              'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
              'w-[92vw] max-w-md',
              'rounded-2xl bg-surface shadow-2xl'
            )}>
              <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
                <Dialog.Title className="text-sm font-semibold text-ink">Delete match rule</Dialog.Title>
                <Dialog.Close className="text-muted hover:text-ink" aria-label="Close">
                  <X size={18} />
                </Dialog.Close>
              </div>

              <div className="p-5 space-y-4">
                {submitError && (
                  <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {submitError}
                  </div>
                )}

                <p className="text-sm text-ink">Delete this match rule?</p>

                <div className="pt-2 flex justify-end gap-2">
                  <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteRule.isPending}
                    className={cn(
                      'px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium',
                      'hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed'
                    )}
                  >
                    {deleteRule.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
      {editError && (
        <p role="alert" className="text-xs text-warn">
          {editError}
        </p>
      )}
    </li>
  )
}
