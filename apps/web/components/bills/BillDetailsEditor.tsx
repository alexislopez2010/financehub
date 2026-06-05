'use client'

import { useMemo } from 'react'
import type { Tables } from '@/lib/supabase/database.types'
import { useUpdateBill } from '@/lib/data/bills'
import { useAccounts } from '@/lib/data/accounts'
import { useCategories } from '@/lib/data/categories'
import { cn } from '@/lib/cn'

type Bill = Tables<'bills'>

export interface BillDetailsEditorProps {
  bill: Bill
}

// Canonical set of cadences the system understands today. Keep aligned with
// AddBillForm — extending in one place requires the same edit in the other.
const FREQUENCIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'Monthly',   label: 'Monthly' },
  { value: 'Biweekly',  label: 'Biweekly' },
  { value: 'Weekly',    label: 'Weekly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'Annual',    label: 'Annual' }
]

// Month labels for the anchor-month picker shown on Quarterly + Annual
// cadences. Values are 1..12 (matching `due_month_anchor` in the DB).
const MONTHS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1,  label: 'January' },
  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

/**
 * Cadences that require a due_month_anchor (1..12). Monthly/Biweekly/Weekly
 * ignore the anchor entirely. Keep aligned with billCadence.ts.
 */
function needsAnchor(freq: string | null | undefined): boolean {
  if (!freq) return false
  const n = freq.toLowerCase().replace(/[-_\s]/g, '')
  return (
    n === 'quarterly' || n === 'quarter' ||
    n === 'annual'    || n === 'annually' || n === 'yearly'
  )
}

/**
 * Inline editor for every editable column on a bill. Mounts inside
 * BillExpanded so the row's chevron toggles both "details" and "matched
 * transactions" with one interaction.
 *
 * Behavior choices worth calling out:
 *   - Each field commits its own mutation on change/blur; there's no Save
 *     button. Optimistic update via useUpdateBill is the source of UX
 *     responsiveness here.
 *   - Category and account use selects populated from useCategories /
 *     useAccounts. The category select stays as a plain <select> with an
 *     optgroup split (Expense / Income / Other) — same shape as AddBillForm.
 *     Free-text category names that don't match any row in the categories
 *     table still render correctly (we show the raw text below the select
 *     in muted gray and let the user pick a canonical category to overwrite).
 *   - Notes is a small textarea, debounced via blur to limit mutations.
 *   - is_active uses a checkbox; flipping it removes the bill from forecast
 *     + coming-due lists without deleting historical data.
 */
export function BillDetailsEditor({ bill }: BillDetailsEditorProps) {
  const updateBill = useUpdateBill()
  const accountsQ = useAccounts()
  const categoriesQ = useCategories()

  const categories = categoriesQ.data ?? []
  const accounts = accountsQ.data ?? []

  // Group categories by type for the dropdown — matches AddBillForm's UX.
  const grouped = useMemo(() => {
    const exp: Array<{ id: string; name: string }> = []
    const inc: Array<{ id: string; name: string }> = []
    const other: Array<{ id: string; name: string }> = []
    const seen = new Set<string>()
    for (const c of categories) {
      const key = c.name.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      const entry = { id: c.id, name: c.name }
      if (c.type === 'expense') exp.push(entry)
      else if (c.type === 'income') inc.push(entry)
      else other.push(entry)
    }
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
    return { expense: exp.sort(byName), income: inc.sort(byName), other: other.sort(byName) }
  }, [categories])

  // Whether the bill's free-text category matches any known category row.
  // When false (legacy free-text), the dropdown shows a "(custom)" entry so
  // the value is preserved instead of silently switching to "(none)".
  const matchedCategory = categories.find(
    c => c.name.trim().toLowerCase() === (bill.category ?? '').trim().toLowerCase()
  )
  const categorySelectValue = matchedCategory?.name ?? (bill.category ? '__custom__' : '')

  function patch(field: keyof Bill, value: unknown): void {
    updateBill.mutate({ id: bill.id, patch: { [field]: value } as Partial<Bill> })
  }

  function handleCategoryChange(next: string): void {
    if (next === '') {
      // Clear both fields so the bill drops back to "uncategorized" without
      // leaving a stale FK pointing at a category we no longer claim.
      updateBill.mutate({ id: bill.id, patch: { category: null, budget_category_id: null } })
      return
    }
    if (next === '__custom__') {
      // '__custom__' is non-interactive — only appears when the existing
      // value doesn't match any category row. Ignore the change.
      return
    }
    // Canonical category picked. Resolve to the row id so the Plan rollup
    // sees the bill immediately — previously this only wrote the free-text
    // `category` and left `budget_category_id` NULL.
    const match = categories.find(
      c => c.name.trim().toLowerCase() === next.trim().toLowerCase()
    )
    updateBill.mutate({
      id: bill.id,
      patch: {
        category: next,
        budget_category_id: match?.id ?? null
      }
    })
  }

  const isPending = updateBill.isPending

  return (
    <div className="rounded-md border border-rule bg-surface p-3 space-y-3">
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
        Bill details
      </div>

      {/* Row 1: Name */}
      <Field label="Name">
        <input
          type="text"
          aria-label="Name"
          defaultValue={bill.name}
          onBlur={e => {
            const v = e.target.value.trim()
            if (v && v !== bill.name) patch('name', v)
          }}
          disabled={isPending}
          className={inputClass}
        />
      </Field>

      {/* Row 2: Frequency · Due day · Amount */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Frequency">
          <select
            aria-label="Frequency"
            value={bill.frequency ?? 'Monthly'}
            onChange={e => patch('frequency', e.target.value)}
            disabled={isPending}
            className={inputClass}
          >
            {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Due day">
          <input
            type="number"
            aria-label="Due day"
            min={1}
            max={31}
            defaultValue={bill.due_day ?? ''}
            onBlur={e => {
              const raw = e.target.value.trim()
              if (raw === '') {
                if (bill.due_day !== null) patch('due_day', null)
                return
              }
              const n = parseInt(raw, 10)
              if (Number.isNaN(n)) return
              const clamped = Math.min(Math.max(n, 1), 31)
              if (clamped !== bill.due_day) patch('due_day', clamped)
            }}
            placeholder="—"
            disabled={isPending}
            className={cn(inputClass, 'tabular text-right')}
          />
        </Field>
        <Field label="Amount">
          <input
            type="number"
            aria-label="Amount"
            step="0.01"
            min={0}
            defaultValue={bill.budget_amount}
            onBlur={e => {
              const n = parseFloat(e.target.value)
              if (Number.isNaN(n) || n < 0) return
              if (n !== bill.budget_amount) patch('budget_amount', n)
            }}
            disabled={isPending}
            className={cn(inputClass, 'tabular text-right')}
          />
        </Field>
      </div>

      {/* Row 2b: Anchor month — only meaningful for Quarterly / Annual */}
      {needsAnchor(bill.frequency) && (
        <Field
          label={bill.frequency?.toLowerCase().startsWith('quart')
            ? 'Anchor month (first occurrence)'
            : 'Month'}
        >
          <select
            aria-label="Anchor month"
            value={bill.due_month_anchor ?? ''}
            onChange={e => {
              const raw = e.target.value
              const next = raw === '' ? null : parseInt(raw, 10)
              patch('due_month_anchor', next)
            }}
            disabled={isPending}
            className={inputClass}
          >
            <option value="">— pick a month —</option>
            {MONTHS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <div className="text-[11px] text-muted mt-1">
            {bill.frequency?.toLowerCase().startsWith('quart')
              ? 'Bill repeats every 3 months from this anchor.'
              : 'Bill hits once a year in this month.'}
            {bill.due_month_anchor == null && (
              <span className="text-rose-600"> — not scheduled until set.</span>
            )}
          </div>
        </Field>
      )}

      {/* Row 3: Account · Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Account">
          <select
            aria-label="Account"
            value={bill.account ?? ''}
            onChange={e => patch('account', e.target.value === '' ? null : e.target.value)}
            disabled={isPending || accountsQ.isLoading}
            className={inputClass}
          >
            <option value="">(none)</option>
            {accounts.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select
            aria-label="Category"
            value={categorySelectValue}
            onChange={e => handleCategoryChange(e.target.value)}
            disabled={isPending || categoriesQ.isLoading}
            className={inputClass}
          >
            <option value="">(none)</option>
            {categorySelectValue === '__custom__' && (
              <option value="__custom__">{`(custom) ${bill.category}`}</option>
            )}
            {grouped.expense.length > 0 && (
              <optgroup label="Expense">
                {grouped.expense.map(c => <option key={`e-${c.id}`} value={c.name}>{c.name}</option>)}
              </optgroup>
            )}
            {grouped.income.length > 0 && (
              <optgroup label="Income">
                {grouped.income.map(c => <option key={`i-${c.id}`} value={c.name}>{c.name}</option>)}
              </optgroup>
            )}
            {grouped.other.length > 0 && (
              <optgroup label="Other">
                {grouped.other.map(c => <option key={`o-${c.id}`} value={c.name}>{c.name}</option>)}
              </optgroup>
            )}
          </select>
        </Field>
      </div>

      {/* Row 4: Notes */}
      <Field label="Notes">
        <textarea
          aria-label="Notes"
          defaultValue={bill.notes ?? ''}
          rows={2}
          onBlur={e => {
            const v = e.target.value
            const normalized = v === '' ? null : v
            if (normalized !== (bill.notes ?? null)) patch('notes', normalized)
          }}
          disabled={isPending}
          className={cn(inputClass, 'resize-y min-h-[3em]')}
          placeholder="Anything to remember about this bill"
        />
      </Field>

      {/* Row 5: Active toggle */}
      <label className="flex items-center gap-2 text-xs text-ink cursor-pointer select-none">
        <input
          type="checkbox"
          checked={bill.is_active ?? false}
          onChange={e => patch('is_active', e.target.checked)}
          disabled={isPending}
          className="h-4 w-4 rounded border-rule text-brand focus:ring-brand/40"
        />
        <span>Active</span>
        <span className="text-muted">— inactive bills are hidden from forecast + coming-due</span>
      </label>
    </div>
  )
}

const inputClass =
  'w-full text-sm rounded-md border border-rule px-2 py-1.5 bg-bg text-ink ' +
  'focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-muted">{label}</div>
      {children}
    </div>
  )
}
