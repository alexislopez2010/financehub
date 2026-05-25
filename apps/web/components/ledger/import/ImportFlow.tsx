'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { ImportRow } from '@/lib/import/adapters/types'
import { UploadStep } from './UploadStep'

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
}

interface PlaceholderPreviewProps {
  payload: ImportPayload
  onBack: () => void
}

function PlaceholderPreview({ payload, onBack }: PlaceholderPreviewProps) {
  return (
    <div className="rounded-xl border border-rule bg-surface p-6 shadow-sm">
      <p className="text-sm italic text-muted">
        Preview UI lands in Phase 3A T3. Detected{' '}
        <span className="font-medium text-ink">{payload.adapterName}</span>{' '}
        with {payload.parsedRows.length} new + {payload.duplicateRows.length} duplicate row(s)
        for account <span className="font-medium text-ink">{payload.accountName}</span>.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-4 rounded-lg border border-rule px-3 py-1.5 text-sm text-muted hover:text-ink"
      >
        Back
      </button>
    </div>
  )
}

export function ImportFlow() {
  const [step, setStep] = useState<ImportStep>('upload')
  const [payload, setPayload] = useState<ImportPayload | null>(null)

  function handleParsed(next: ImportPayload) {
    setPayload(next)
    setStep('preview')
  }

  function handleBack() {
    setStep('upload')
  }

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
        <PlaceholderPreview payload={payload} onBack={handleBack} />
      )}
    </div>
  )
}
