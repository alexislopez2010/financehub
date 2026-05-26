'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { ImportRow } from '@/lib/import/adapters/types'
import type { InsertResult } from '@/lib/import/insert'
import { UploadStep } from './UploadStep'
import { PreviewStep } from './PreviewStep'
import { CompleteStep } from './CompleteStep'

export type ImportStep = 'upload' | 'preview' | 'complete'

export interface SkippedReport {
  rowIndex: number
  reason: string
}

export interface ImportPayload {
  accountId: string
  accountName: string
  adapterName: string
  parsedRows: ReadonlyArray<ImportRow>
  duplicateRows: ReadonlyArray<ImportRow>
  skipped: ReadonlyArray<SkippedReport>
  /** Pre-selected member to assign to every imported row. null = unassigned. */
  member: string | null
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

export function ImportFlow() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [payload, setPayload] = useState<ImportPayload | null>(null)
  const [result, setResult] = useState<InsertResult | null>(null)

  function handleParsed(next: ImportPayload) {
    setPayload(next)
    setStep('preview')
  }

  function handleBack() {
    setStep('upload')
  }

  function handleComplete(next: InsertResult) {
    setResult(next)
    setStep('complete')
  }

  function handleReset() {
    setPayload(null)
    setResult(null)
    setStep('upload')
  }

  const completeDateRange = useMemo(
    () => deriveDateRange(payload?.parsedRows ?? []),
    [payload]
  )

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Import transactions</h1>
          <p className="text-sm text-muted">CSV from your bank.</p>
        </div>
        <Link href="/ledger" className="text-sm text-muted hover:text-ink">
          ← Back to Ledger
        </Link>
      </header>

      {step === 'upload' && <UploadStep onParsed={handleParsed} />}

      {step === 'preview' && payload && (
        <PreviewStep
          payload={payload}
          onBack={handleBack}
          onComplete={handleComplete}
        />
      )}

      {step === 'complete' && payload && result && (
        <CompleteStep
          result={result}
          accountId={payload.accountId}
          accountName={payload.accountName}
          dateRange={completeDateRange}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
