'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle, RotateCcw, XCircle } from 'lucide-react'
import type { InsertResult } from '@/lib/import/insert'

export interface CompleteStepProps {
  result: InsertResult
  accountId: string
  accountName: string
  dateRange: { start: string; end: string }
  onReset: () => void
}

function buildLedgerHref(accountName: string, dateRange: { start: string; end: string }): string {
  const params = new URLSearchParams()
  // The Ledger filter API uses account *name* (text column), not account_id.
  if (accountName) params.set('account', accountName)
  if (dateRange.start) params.set('start', dateRange.start)
  if (dateRange.end) params.set('end', dateRange.end)
  const qs = params.toString()
  return qs ? `/ledger?${qs}` : '/ledger'
}

export function CompleteStep({ result, accountId: _accountId, accountName, dateRange, onReset }: CompleteStepProps) {
  const insertedLabel = result.inserted === 1 ? '1 transaction' : `${result.inserted} transactions`
  const ledgerHref = buildLedgerHref(accountName, dateRange)
  const isFailure = result.inserted === 0
  const hasPartialFailure = result.inserted > 0 && result.failed.length > 0

  return (
    <div className="rounded-xl border border-rule bg-surface p-8 shadow-sm space-y-6">
      <div className="flex flex-col items-center text-center gap-3">
        {isFailure ? (
          <>
            <XCircle size={48} className="text-red-600" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-red-700">Import didn&apos;t insert anything</h2>
            <p className="text-sm text-muted">
              {result.failed.length > 0
                ? `All ${result.failed.length} row${result.failed.length === 1 ? '' : 's'} failed at insert. See details below.`
                : 'No rows were available to insert. The CSV may have had every row skipped during parsing — go back to Upload and check the skip reasons.'}
            </p>
          </>
        ) : (
          <>
            <CheckCircle size={48} className="text-emerald-600" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-ink">Imported {insertedLabel}</h2>
            <p className="text-sm text-muted">into {accountName}</p>
          </>
        )}
      </div>

      {result.failed.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 space-y-2">
          <p className="font-medium">
            {result.failed.length} row{result.failed.length === 1 ? '' : 's'} failed to import
          </p>
          <details open={isFailure || hasPartialFailure}>
            <summary className="cursor-pointer text-xs text-red-700/80 hover:text-red-800">
              See details
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-red-700/90">
              {result.failed.map((f, idx) => (
                <li key={`${f.row.fingerprint || idx}`} className="flex gap-2">
                  <span className="font-mono text-red-700/70 tabular">{f.row.date}</span>
                  <span className="truncate" title={f.row.description}>{f.row.description}</span>
                  <span className="text-red-700/70">—</span>
                  <span className="italic">{f.error}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
        {isFailure ? (
          <>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Back to Upload
            </button>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-surface px-4 py-2 text-sm text-ink hover:bg-bg"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Import another
            </button>
          </>
        ) : (
          <>
            <Link
              href={ledgerHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
            >
              View in Ledger
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rule bg-surface px-4 py-2 text-sm text-ink hover:bg-bg"
            >
              <RotateCcw size={14} aria-hidden="true" />
              Import another
            </button>
          </>
        )}
      </div>
    </div>
  )
}
