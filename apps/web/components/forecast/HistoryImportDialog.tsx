'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { X, Sparkles, Check } from 'lucide-react'
import { useUpdateBill } from '@/lib/data/bills'
import { parseHistory } from '@/lib/forecast/parseHistory'
import { distillSeasonalProfile } from '@/lib/forecast/distillHistory'
import type { SeasonalProfile } from '@/lib/forecast/seasonalProfile'
import type { Json } from '@/lib/supabase/database.types'
import { cn } from '@/lib/cn'

const MONTH_ABBR = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'] as const
const MONTH_FULL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const MAX_RAW_CHARS = 20_000

function fmtUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface ParsedResult {
  profile: SeasonalProfile
  monthsCovered: number
  observationsUsed: number
  warnings: string[]
  /** Non-empty lines the parser couldn't read. */
  skipped: number
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
  const [result, setResult] = useState<ParsedResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const updateBill = useUpdateBill()
  const selectedBill = bills.find(b => b.id === billId)

  function resetAndClose(next: boolean) {
    if (!next) {
      setRawText('')
      setResult(null)
      setParseError(null)
      setSaved(false)
      updateBill.reset()
    }
    onOpenChange(next)
  }

  function handleParse() {
    if (!selectedBill || rawText.trim().length === 0) return
    setParseError(null)
    setResult(null)
    const { observations, skipped } = parseHistory(rawText, { defaultYear: new Date().getFullYear() })
    const distilled = distillSeasonalProfile(observations, {
      computedAt: new Date().toISOString().slice(0, 10),
      note: `Parsed ${observations.length} ${observations.length === 1 ? 'amount' : 'amounts'} from your pasted history.`
    })
    if (!distilled.ok) {
      setParseError(
        skipped > 0
          ? `Couldn’t read any month + amount pairs (${skipped} unrecognized ${skipped === 1 ? 'line' : 'lines'}). Try one "Month Year  $amount" per line.`
          : 'Couldn’t find any month + amount pairs in that text.'
      )
      return
    }
    setResult({
      profile: distilled.profile,
      monthsCovered: distilled.monthsCovered,
      observationsUsed: distilled.observationsUsed,
      warnings: distilled.warnings,
      skipped
    })
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

  const canParse = !!selectedBill && rawText.trim().length > 0

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
              Paste this bill’s past amounts — one <span className="font-medium text-ink">Month Year&nbsp;&nbsp;$amount</span> per
              line (tables, CSV exports, and ISO dates also work). The app reads them and computes a seasonal profile.
              Nothing is sent anywhere; your text isn’t stored.
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
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Bill</span>
                  <select
                    value={billId}
                    onChange={e => { setBillId(e.target.value); setResult(null); setParseError(null) }}
                    disabled={updateBill.isPending}
                    className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
                  >
                    {bills.length === 0 && <option value="">No bills available</option>}
                    {bills.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">History</span>
                  <textarea
                    value={rawText}
                    onChange={e => setRawText(e.target.value.slice(0, MAX_RAW_CHARS))}
                    rows={6}
                    placeholder={'Jan 2024  $182.34\nFeb 2024  $171.05\nMar 2024  $140.10\n…'}
                    className="w-full resize-y rounded-lg border border-rule bg-surface px-3 py-2 font-mono text-xs text-ink"
                  />
                  <span className="mt-1 block text-right text-[10px] text-muted">{rawText.length.toLocaleString()} / {MAX_RAW_CHARS.toLocaleString()}</span>
                </label>

                {parseError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{parseError}</p>
                )}

                {result && (
                  <div className="space-y-3 rounded-xl border border-rule bg-bg p-3">
                    <span className="text-xs font-semibold text-ink">Distilled profile</span>
                    <ProfilePreview profile={result.profile} />
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span>{result.monthsCovered}/12 months covered</span>
                      <span>{result.observationsUsed} {result.observationsUsed === 1 ? 'amount' : 'amounts'}</span>
                      <span>{result.profile.years} {result.profile.years === 1 ? 'year' : 'years'}</span>
                    </div>
                    {result.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-amber-700">{w}</p>
                    ))}
                    {result.skipped > 0 && (
                      <p className="text-[11px] text-amber-700">
                        {result.skipped} {result.skipped === 1 ? 'line was' : 'lines were'} unrecognized and skipped.
                      </p>
                    )}
                    {updateBill.isError && (
                      <p role="alert" className="rounded bg-red-50 px-2 py-1 text-[11px] text-red-700">{updateBill.error.message}</p>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  {!result ? (
                    <button
                      type="button"
                      onClick={handleParse}
                      disabled={!canParse}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                    >
                      <Sparkles size={14} />
                      Preview profile
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setResult(null)}
                        disabled={updateBill.isPending}
                        className="rounded-lg border border-rule px-3 py-1.5 text-sm font-medium text-muted hover:text-ink disabled:opacity-40"
                      >
                        Edit text
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
