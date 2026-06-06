'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, Upload } from 'lucide-react'
import { useCategories } from '@/lib/data/categories'
import type { ImportRow } from '@/lib/import/adapters/types'
import { insertImportedTransactions, type InsertResult } from '@/lib/import/insert'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'
import { DetectedBanner } from './DetectedBanner'
import { PreviewRow } from './PreviewRow'
import type { ImportPayload } from './ImportFlow'

/** Cap the rendered preview table size — full count still imports. */
const PREVIEW_LIMIT = 100

export interface PreviewStepProps {
  payload: ImportPayload
  onBack: () => void
  onComplete: (result: InsertResult) => void
}

interface InsertingState {
  done: number
  total: number
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function deriveDateRange(rows: ReadonlyArray<ImportRow>): { start: string; end: string } {
  if (rows.length === 0) return { start: '', end: '' }
  let min = rows[0]!.date
  let max = rows[0]!.date
  for (const r of rows) {
    if (r.date < min) min = r.date
    if (r.date > max) max = r.date
  }
  return { start: min, end: max }
}

function deriveNetTotal(rows: ReadonlyArray<ImportRow>): number {
  let net = 0
  for (const r of rows) {
    if (r.type === 'Income' || r.type === 'Refund') net += Math.abs(r.amount)
    else if (r.type === 'Expense') net -= Math.abs(r.amount)
  }
  return Math.round(net * 100) / 100
}

export function PreviewStep({ payload, onBack, onComplete }: PreviewStepProps) {
  const categoriesQ = useCategories()
  const [inserting, setInserting] = useState<InsertingState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDuplicates, setShowDuplicates] = useState(false)

  const categoryById = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of categoriesQ.data ?? []) map.set(c.id, c.name)
    return map
  }, [categoriesQ.data])

  const newRows = payload.parsedRows
  const dupRows = payload.duplicateRows
  const categorizedCount = newRows.filter(r => r.categoryId !== null).length
  const uncategorizedCount = newRows.length - categorizedCount
  const dateRange = useMemo(() => deriveDateRange(newRows), [newRows])
  const net = useMemo(() => deriveNetTotal(newRows), [newRows])
  const visibleRows = newRows.slice(0, PREVIEW_LIMIT)
  const hiddenCount = newRows.length - visibleRows.length

  async function handleImport() {
    setError(null)
    setInserting({ done: 0, total: newRows.length })
    try {
      const supabase = createClient()
      const result = await insertImportedTransactions({
        supabase,
        rows: newRows,
        householdId: LOPEZ_HOUSEHOLD_ID,
        accountId: payload.accountId,
        accountName: payload.accountName,
        member: payload.member,
        // Pass the categoryId → name map so the importer writes the
        // `category` text field alongside `category_id`. Surfaces that
        // bucket on text (spendByCategory, deriveBudgetVsActual, etc.)
        // would otherwise treat auto-categorized rows as Uncategorized.
        categoryById,
        onProgress: (done, total) => setInserting({ done, total })
      })
      onComplete(result)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to import transactions'
      setError(msg)
      setInserting(null)
    }
  }

  const isBusy = inserting !== null
  const importLabel = isBusy
    ? `Inserting… ${inserting.done} of ${inserting.total}`
    : `Import ${newRows.length} transaction${newRows.length === 1 ? '' : 's'}`

  if (newRows.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 mt-0.5" aria-hidden="true" />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-amber-900">All rows skipped</h3>
            <p className="text-sm text-amber-800">
              The {payload.adapterName} adapter found {payload.skipped.length} row{payload.skipped.length === 1 ? '' : 's'} but couldn&apos;t parse any of them. Common causes: unexpected date format, missing description, all rows marked Pending.
            </p>
          </div>
        </div>

        {payload.skipped.length > 0 && (
          <details open className="text-xs">
            <summary className="cursor-pointer text-amber-900 font-medium">
              {payload.skipped.length} skipped row{payload.skipped.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {payload.skipped.slice(0, 50).map((s, idx) => (
                <li key={idx} className="flex gap-2 text-amber-900">
                  <span className="font-mono text-amber-700">row {s.rowIndex + 1}</span>
                  <span className="italic">{s.reason}</span>
                </li>
              ))}
              {payload.skipped.length > 50 && (
                <li className="italic text-amber-700">…and {payload.skipped.length - 50} more</li>
              )}
            </ul>
          </details>
        )}

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Upload
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-rule bg-surface p-6 shadow-sm space-y-5">
        <DetectedBanner
          adapterName={payload.adapterName}
          rowCount={newRows.length}
          dateRange={dateRange}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryTile label="New" value={newRows.length.toString()} tone="emerald" />
          <SummaryTile label="Skipped duplicates" value={dupRows.length.toString()} tone="gray" />
          <SummaryTile label="Categorized" value={categorizedCount.toString()} tone="blue" />
        </div>

        {uncategorizedCount > 0 && (
          <p className="text-xs text-muted">
            {uncategorizedCount} uncategorized row{uncategorizedCount === 1 ? '' : 's'} will be
            imported as Uncategorized — you can categorize {uncategorizedCount === 1 ? 'it' : 'them'} in
            Ledger.
          </p>
        )}

        <div className="border border-rule rounded-lg overflow-hidden bg-bg">
          <div className="grid gap-3 items-center px-4 py-2 text-[11px] uppercase tracking-wider text-muted font-semibold border-b border-rule grid-cols-[60px_1fr_120px_100px] sm:grid-cols-[60px_1fr_180px_100px]">
            <div>Date</div>
            <div>Description</div>
            <div className="hidden sm:block">Category</div>
            <div className="text-right">Amount</div>
          </div>
          {visibleRows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm italic text-muted">
              No new rows to import.
            </p>
          ) : (
            visibleRows.map((row, idx) => (
              <PreviewRow
                key={row.fingerprint || `${row.date}-${idx}`}
                row={row}
                categoryName={row.categoryId ? categoryById.get(row.categoryId) ?? null : null}
              />
            ))
          )}
          {hiddenCount > 0 && (
            <p className="px-4 py-2 text-center text-xs italic text-muted border-t border-rule">
              … and {hiddenCount} more (all will be imported)
            </p>
          )}
        </div>

        {dupRows.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowDuplicates(s => !s)}
              className="text-xs text-muted hover:text-ink underline-offset-2 hover:underline"
            >
              {showDuplicates ? 'Hide' : 'Show'} skipped duplicates ({dupRows.length})
            </button>
            {showDuplicates && (
              <div className="border border-rule rounded-lg overflow-hidden bg-bg">
                {dupRows.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                  <PreviewRow
                    key={`dup-${row.fingerprint || idx}`}
                    row={row}
                    categoryName={row.categoryId ? categoryById.get(row.categoryId) ?? null : null}
                    duplicate
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <div
        className={cn(
          'sticky bottom-0 z-10',
          'bg-surface border border-rule rounded-xl shadow-sm',
          'px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3'
        )}
      >
        <div className="text-xs text-muted">
          <span className="font-medium text-ink tabular">{newRows.length}</span>{' '}
          row{newRows.length === 1 ? '' : 's'}{' '}
          <span className="text-muted/70">·</span>{' '}
          <span className="text-ink tabular">
            net {net >= 0 ? '+' : '−'}{formatUSD(Math.abs(net))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-60"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isBusy || newRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {isBusy ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={14} aria-hidden="true" />
            )}
            {importLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  tone: 'emerald' | 'gray' | 'blue'
}

const toneToClasses: Record<SummaryTileProps['tone'], string> = {
  emerald: 'text-emerald-600',
  gray: 'text-gray-600',
  blue: 'text-blue-600'
}

function SummaryTile({ label, value, tone }: SummaryTileProps) {
  return (
    <div className="bg-bg border border-rule rounded-lg p-4 flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
        {label}
      </div>
      <div className={cn('text-2xl font-bold tabular tracking-tight', toneToClasses[tone])}>
        {value}
      </div>
    </div>
  )
}
