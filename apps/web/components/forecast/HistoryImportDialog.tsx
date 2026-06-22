'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { X, Sparkles, Check } from 'lucide-react'
import { useAnalyzeBillHistory, type AnalyzeHistoryResult } from '@/lib/data/forecastMutations'
import { useUpdateBill } from '@/lib/data/bills'
import type { SeasonalProfile } from '@/lib/forecast/seasonalProfile'
import type { Json } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'

const MONTH_ABBR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const
const MONTH_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MAX_RAW_CHARS = 20_000

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const CONFIDENCE_TONE: Record<AnalyzeHistoryResult['confidence'], string> = {
  high: 'bg-emerald-50 text-emerald-700',
  medium: 'bg-amber-50 text-amber-700',
  low: 'bg-red-50 text-red-700'
}

export interface BillPick {
  id: string
  name: string
}

export interface HistoryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bills: ReadonlyArray<BillPick>
  /** Optionally preselect a bill (e.g. opened from a specific row). */
  initialBillId?: string
}

/** Compact 12-bar preview of a distilled seasonal profile. */
function ProfilePreview({ profile }: { profile: SeasonalProfile }) {
  const max = Math.max(1, ...profile.baseline)
  return (
    <div className="flex items-end gap-1" style={{ height: 88 }} aria-hidden="true">
      {profile.baseline.map((amt, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full items-end justify-center" style={{ height: 64 }}>
            <div
              className="w-full rounded-t bg-brand/70"
              style={{ height: `${Math.max(2, (amt / max) * 64)}px` }}
              title={`${MONTH_FULL[i]}: ${fmtUSD(amt)}`}
            />
          </div>
          <span className="text-[9px] text-muted">{MONTH_ABBR[i]}</span>
        </div>
      ))}
    </div>
  )
}

export function HistoryImportDialog({ open, onOpenChange, bills, initialBillId }: HistoryImportDialogProps) {
  const [billId, setBillId] = useState(initialBillId ?? bills[0]?.id ?? '')
  const [rawText, setRawText] = useState('')
  const [result, setResult] = useState<AnalyzeHistoryResult | null>(null)
  const [saved, setSaved] = useState(false)

  const analyze = useAnalyzeBillHistory()
  const updateBill = useUpdateBill()

  const selectedBill = bills.find(b => b.id === billId)

  function resetAndClose(next: boolean) {
    if (!next) {
      // Clear transient state on close so reopening starts fresh.
      setRawText('')
      setResult(null)
      setSaved(false)
      analyze.reset()
      updateBill.reset()
    }
    onOpenChange(next)
  }

  async function handleAnalyze() {
    if (!selectedBill || rawText.trim().length === 0) return
    setResult(null)
    try {
      const r = await analyze.mutateAsync({ billName: selectedBill.name, rawText: rawText.trim() })
      setResult(r)
    } catch {
      // analyze.error renders below.
    }
  }

  async function handleSave() {
    if (!result || !selectedBill) return
    try {
      // SeasonalProfile is plain JSON data; the column type is Json (no index
      // signature on the interface, hence the structural cast).
      await updateBill.mutateAsync({ id: selectedBill.id, patch: { seasonal_profile: result.profile as unknown as Json } })
      setSaved(true)
    } catch {
      // updateBill.error renders below.
    }
  }

  const canAnalyze = !!selectedBill && rawText.trim().length > 0 && !analyze.isPending

  return (
    <Dialog.Root open={open} onOpenChange={resetAndClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[92vw] max-w-lg max-h-[88vh] overflow-y-auto',
          'rounded-2xl bg-surface shadow-2xl'
        )}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-surface px-5 py-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-brand" />
              <Dialog.Title className="text-sm font-semibold text-ink">Import bill history</Dialog.Title>
            </div>
            <Dialog.Close className="rounded p-1 text-muted hover:bg-bg hover:text-ink" aria-label="Close">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="space-y-4 px-5 py-4">
            <Dialog.Description className="text-xs text-muted">
              Paste any history you have for this bill — a table, a list of months, or even a rough description.
              The AI reads it and the app computes a verified seasonal profile. Your raw text is never stored.
            </Dialog.Description>

            {saved ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check size={20} />
                </span>
                <p className="text-sm font-medium text-ink">Seasonal profile saved for {selectedBill?.name}.</p>
                <p className="text-xs text-muted">The forecast now projects this bill from its seasonal history.</p>
                <button
                  type="button"
                  onClick={() => resetAndClose(false)}
                  className="mt-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Bill picker */}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Bill</span>
                  <select
                    value={billId}
                    onChange={e => { setBillId(e.target.value); setResult(null) }}
                    disabled={analyze.isPending || updateBill.isPending}
                    className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
                  >
                    {bills.length === 0 && <option value="">No bills available</option>}
                    {bills.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>

                {/* History input */}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">History</span>
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value.slice(0, MAX_RAW_CHARS))}
                    rows={6}
                    placeholder={'e.g.\nJan 2024  $182.34\nFeb 2024  $171.05\n…\nor: "winters run about $180/mo, summers around $45"'}
                    className="w-full resize-y rounded-lg border border-rule bg-surface px-3 py-2 font-mono text-xs text-ink"
                  />
                  <span className="mt-1 block text-right text-[10px] text-muted">{rawText.length.toLocaleString()} / {MAX_RAW_CHARS.toLocaleString()}</span>
                </label>

                {analyze.isError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{analyze.error.message}</p>
                )}

                {/* Preview */}
                {result && (
                  <div className="space-y-3 rounded-xl border border-rule bg-bg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-ink">Distilled profile</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', CONFIDENCE_TONE[result.confidence])}>
                        {result.confidence} confidence
                      </span>
                    </div>
                    <ProfilePreview profile={result.profile} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span>{result.monthsCovered}/12 months covered</span>
                      <span>{result.observationsUsed} observations</span>
                      <span>{result.profile.years} {result.profile.years === 1 ? 'year' : 'years'}</span>
                    </div>
                    {result.note && <p className="text-[11px] italic text-muted">“{result.note}”</p>}
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-amber-700">{w}</p>
                    ))}
                    {updateBill.isError && (
                      <p role="alert" className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{updateBill.error.message}</p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  {!result ? (
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={!canAnalyze}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      <Sparkles size={14} />
                      {analyze.isPending ? 'Analyzing…' : 'Analyze'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setResult(null)}
                        disabled={updateBill.isPending}
                        className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-muted hover:text-ink disabled:opacity-40"
                      >
                        Re-analyze
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={updateBill.isPending}
                        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                      >
                        {updateBill.isPending ? 'Saving…' : 'Save profile'}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
