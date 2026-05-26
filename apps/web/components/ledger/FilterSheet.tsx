'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useAccounts } from '@/lib/data/accounts'
import { useCategories } from '@/lib/data/categories'
import { useHouseholdMembersList } from '@/lib/data/householdMembers'
import type { LedgerFilters } from '@/lib/ledger/filters'
import { cn } from '@/lib/cn'

export interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: LedgerFilters
  onChange: (next: LedgerFilters) => void
}

export function FilterSheet({ open, onOpenChange, filters, onChange }: FilterSheetProps) {
  const accountsQ = useAccounts()
  const categoriesQ = useCategories()
  const membersQ = useHouseholdMembersList()

  // Filter chip + sheet share the same option list. Family is synthetic;
  // we do NOT include '(Unassigned)' here — filtering for null member is
  // rarely useful.
  const memberOptionValues: ReadonlyArray<string> = (() => {
    const FAMILY = 'Family'
    const seen = new Set<string>([FAMILY])
    const out: string[] = [FAMILY]
    for (const m of membersQ.data ?? []) {
      const name = m.display_name
      if (name.length === 0 || seen.has(name)) continue
      out.push(name)
      seen.add(name)
    }
    return out
  })()

  function setField<K extends keyof LedgerFilters>(key: K, value: LedgerFilters[K] | undefined) {
    const next = { ...filters }
    if (value === undefined || value === '') {
      delete next[key]
    } else {
      next[key] = value
    }
    onChange(next)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto',
            'rounded-t-2xl bg-surface shadow-2xl',
            'data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-2'
          )}
        >
          <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-ink">Filters</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink"><X size={18} /></Dialog.Close>
          </div>

          <div className="p-5 space-y-4">
            <Field label="From">
              <input type="date" value={filters.startDate ?? ''}
                onChange={e => setField('startDate', e.target.value || undefined)}
                className={inputCls} />
            </Field>
            <Field label="To">
              <input type="date" value={filters.endDate ?? ''}
                onChange={e => setField('endDate', e.target.value || undefined)}
                className={inputCls} />
            </Field>

            <Field label="Category">
              <select
                value={filters.categoryId === null ? '__uncategorized__' : filters.categoryId ?? ''}
                onChange={e => {
                  const v = e.target.value
                  if (v === '') setField('categoryId', undefined)
                  else if (v === '__uncategorized__') setField('categoryId', null)
                  else setField('categoryId', v)
                }}
                className={inputCls}
              >
                <option value="">Any</option>
                <option value="__uncategorized__">Uncategorized</option>
                {(categoriesQ.data ?? []).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Account">
              <select value={filters.account ?? ''}
                onChange={e => setField('account', e.target.value || undefined)}
                className={inputCls}>
                <option value="">Any</option>
                {(accountsQ.data ?? []).map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Type">
              <select value={filters.type ?? ''}
                onChange={e => {
                  const v = e.target.value
                  if (!v) setField('type', undefined)
                  else if (v === 'Income' || v === 'Expense' || v === 'Transfer' || v === 'Refund') {
                    setField('type', v)
                  }
                }}
                className={inputCls}>
                <option value="">Any</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Transfer">Transfer</option>
                <option value="Refund">Refund</option>
              </select>
            </Field>

            <Field label="Member">
              <select value={filters.member ?? ''}
                onChange={e => setField('member', e.target.value || undefined)}
                className={inputCls}>
                <option value="">Any</option>
                {memberOptionValues.map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>

            <fieldset className="block">
              <legend className="text-xs font-medium uppercase tracking-wider text-muted mb-1">Amount</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col">
                  <span className="text-[11px] text-muted mb-0.5">Min</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={filters.minAmount ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '') {
                        setField('minAmount', undefined)
                        return
                      }
                      const n = Number(raw)
                      setField('minAmount', Number.isFinite(n) ? n : undefined)
                    }}
                    className={inputCls}
                    placeholder="$"
                    aria-label="Minimum amount"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-[11px] text-muted mb-0.5">Max</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={filters.maxAmount ?? ''}
                    onChange={e => {
                      const raw = e.target.value
                      if (raw === '') {
                        setField('maxAmount', undefined)
                        return
                      }
                      const n = Number(raw)
                      setField('maxAmount', Number.isFinite(n) ? n : undefined)
                    }}
                    className={inputCls}
                    placeholder="$"
                    aria-label="Maximum amount"
                  />
                </label>
              </div>
              <p className="text-[11px] text-muted mt-1">Use negative numbers for expenses.</p>
            </fieldset>
          </div>

          <div className="sticky bottom-0 bg-surface border-t border-rule px-5 py-3 flex justify-end gap-2">
            <button type="button" onClick={() => onChange({})}
              className="text-sm text-muted hover:text-ink">Reset</button>
            <Dialog.Close className={cn(
              'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
              'hover:bg-brand/90'
            )}>Apply</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const inputCls = 'w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">{label}</span>
      {children}
    </label>
  )
}
