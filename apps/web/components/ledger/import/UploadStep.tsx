'use client'

import { Loader2, UploadCloud } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useAccounts } from '@/lib/data/accounts'
import { useBillMatchRules } from '@/lib/data/billMatchRules'
import { useBills } from '@/lib/data/bills'
import { useCategories } from '@/lib/data/categories'
import { useHouseholdMembersList } from '@/lib/data/householdMembers'
import { detectAdapter } from '@/lib/import/adapters'
import type { ImportRow, ParsedImportRow, SkippedRow } from '@/lib/import/adapters/types'
import { categorize, type CategorizeBill, type CategorizeCategory, type CategorizeRule } from '@/lib/import/categorize'
import { parseCsv } from '@/lib/import/csv'
import { looksLikeOfx, parseOfx } from '@/lib/import/ofx'
import { dedup } from '@/lib/import/dedup'
import { computeFingerprintsBatch } from '@/lib/import/fingerprint'
import { buildMemberOptions } from '@/lib/ledger/memberOptions'
import { cn } from '@/lib/cn'
import { createClient } from '@/lib/supabase/browser'
import type { ImportPayload, SkippedReport } from './ImportFlow'

/** 5 MB cap — bank CSVs are typically 1–10 KB, this is a safety rail. */
const MAX_FILE_BYTES = 5 * 1024 * 1024

type StageKind = 'idle' | 'reading' | 'parsing' | 'dedup' | 'categorizing'

interface Stage {
  kind: StageKind
  /** Optional human-readable detail (e.g. filename, row count). */
  detail?: string
}

interface ParseError {
  message: string
  detail?: string
}

export interface UploadStepProps {
  onParsed: (payload: ImportPayload) => void
}

/** Sentinel value used by the member <select> to represent null (Unassigned). */
const MEMBER_UNASSIGNED_SENTINEL = '__unassigned__'

export function UploadStep({ onParsed }: UploadStepProps) {
  const accountsQ = useAccounts()
  const billsQ = useBills()
  const rulesQ = useBillMatchRules()
  const categoriesQ = useCategories()
  const membersQ = useHouseholdMembersList()

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [selectedMember, setSelectedMember] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const [error, setError] = useState<ParseError | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isBusy = stage.kind !== 'idle'
  const accountSelected = selectedAccountId !== ''
  const canAcceptFile = accountSelected && !isBusy

  const selectedAccount = (accountsQ.data ?? []).find(a => a.id === selectedAccountId)
  const accountName = selectedAccount?.name ?? ''

  const memberOptions = buildMemberOptions(membersQ.data ?? [], [])

  function resetStatus() {
    setError(null)
    setWarning(null)
  }

  function openFilePicker() {
    if (!canAcceptFile) return
    fileInputRef.current?.click()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      void handleFile(file)
    }
  }

  function handleDragOver(e: DragEvent<HTMLButtonElement>) {
    if (!canAcceptFile) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (!canAcceptFile) return
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFile(file)
    }
  }

  async function readFileText(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
      reader.onload = () => {
        const result = reader.result
        if (typeof result !== 'string') {
          reject(new Error('Expected text content from FileReader'))
          return
        }
        resolve(result)
      }
      reader.readAsText(file, 'UTF-8')
    })
  }

  async function fetchExistingFingerprints(
    accountId: string,
    minDate: string,
    maxDate: string
  ): Promise<ReadonlySet<string>> {
    const supabase = createClient()
    const { data, error: queryError } = await supabase
      .from('transactions')
      .select('fingerprint')
      .eq('account_id', accountId)
      .gte('date', minDate)
      .lte('date', maxDate)
      .not('fingerprint', 'is', null)

    if (queryError) throw queryError
    const set = new Set<string>()
    for (const row of data ?? []) {
      if (row.fingerprint) set.add(row.fingerprint)
    }
    return set
  }

  async function handleFile(file: File) {
    resetStatus()

    if (!accountSelected) {
      setError({ message: 'Pick an account first.' })
      return
    }

    if (file.size > MAX_FILE_BYTES) {
      setError({
        message: 'File is too large.',
        detail: `Max 5 MB; this file is ${(file.size / 1024 / 1024).toFixed(2)} MB.`
      })
      return
    }

    const looksLikeCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv'
    const looksLikeQfx = /\.(qfx|ofx)$/i.test(file.name)
    if (!looksLikeCsv && !looksLikeQfx) {
      setWarning(`"${file.name}" doesn't look like a CSV or QFX — attempting to parse anyway.`)
    }

    try {
      setStage({ kind: 'reading', detail: file.name })
      const text = await readFileText(file)

      setStage({ kind: 'parsing' })

      // Two parse paths share the same downstream pipeline (fingerprint →
      // dedup → categorize). OFX/QFX is structured very differently from
      // CSV — leaf tags without close tags, no header row — so we detect
      // it up front and use the dedicated parser instead of trying to
      // shoehorn it into the adapter pattern.
      let parsed: ReadonlyArray<ParsedImportRow>
      let skipped: ReadonlyArray<SkippedRow>
      let sourceLabel: string
      if (looksLikeQfx || looksLikeOfx(text)) {
        const ofx = parseOfx(text)
        parsed = ofx.parsed
        skipped = ofx.skipped
        sourceLabel = ofx.statement.fi
          ? `${ofx.statement.fi} QFX${ofx.statement.accountLastFour ? ` ··${ofx.statement.accountLastFour}` : ''}`
          : 'QFX'
        if (parsed.length === 0) {
          const firstSkip = skipped[0]?.reason
          setError(firstSkip
            ? { message: 'QFX parsed, but no transactions could be read.', detail: firstSkip }
            : { message: 'QFX parsed, but no transactions were found.' }
          )
          setStage({ kind: 'idle' })
          return
        }
        if (ofx.statement.endingBalance !== null) {
          setWarning(
            `Statement ending balance: ${ofx.statement.endingBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}. ` +
            `Verify it matches the account in the platform after import.`
          )
        }
      } else {
        const parsedCsv = parseCsv(text)
        if (parsedCsv.headers.length === 0 || parsedCsv.rows.length === 0) {
          setError({ message: 'CSV looks empty.', detail: 'No data rows were found.' })
          setStage({ kind: 'idle' })
          return
        }

        const adapter = detectAdapter(parsedCsv.headers)
        if (!adapter) {
          setError({
            message: 'Unrecognized CSV format.',
            detail: `Headers detected: ${parsedCsv.headers.join(', ')}. Use one of: Chase, Capital One, Citibank, Discover, Amex, or a CSV with date/description/amount columns.`
          })
          setStage({ kind: 'idle' })
          return
        }

        const adapterResult = adapter.parse(parsedCsv.headers, parsedCsv.rows)
        parsed = adapterResult.parsed
        skipped = adapterResult.skipped
        sourceLabel = adapter.name
        if (parsed.length === 0) {
          const firstSkip = skipped[0]?.reason
          setError(firstSkip
            ? { message: `Detected ${adapter.name}, but no rows could be parsed.`, detail: firstSkip }
            : { message: `Detected ${adapter.name}, but no rows could be parsed.` }
          )
          setStage({ kind: 'idle' })
          return
        }
        if (parsedCsv.hasMalformedRows) {
          setWarning('Some rows had malformed column counts — they may have been skipped.')
        }
      }

      setStage({ kind: 'parsing', detail: `${parsed.length} rows` })

      const fingerprintInputs = parsed.map(r => ({
        date: r.date,
        description: r.description,
        amount: r.amount,
        account: accountName
      }))
      const fingerprints = await computeFingerprintsBatch(fingerprintInputs)

      const importRows: ImportRow[] = parsed.map((row, idx) => ({
        ...row,
        fingerprint: fingerprints[idx] ?? '',
        categoryId: null,
        billId: null
      }))

      const minDate = importRows.reduce(
        (acc, r) => (r.date < acc ? r.date : acc),
        importRows[0]?.date ?? ''
      )
      const maxDate = importRows.reduce(
        (acc, r) => (r.date > acc ? r.date : acc),
        importRows[0]?.date ?? ''
      )

      setStage({ kind: 'dedup' })
      const existing = await fetchExistingFingerprints(selectedAccountId, minDate, maxDate)
      const { newRows, duplicateRows } = dedup(importRows, existing)

      setStage({ kind: 'categorizing' })
      const rules: ReadonlyArray<CategorizeRule> = (rulesQ.data ?? []).map(r => ({
        id: r.id,
        bill_id: r.bill_id,
        bill_name: r.bill_name,
        rule_kind: r.rule_kind,
        keyword: r.keyword,
        sub_category: r.sub_category,
        category: r.category,
        account_filter: r.account_filter
      }))
      const bills: ReadonlyArray<CategorizeBill> = (billsQ.data ?? []).map(b => ({
        id: b.id,
        name: b.name,
        category: b.category
      }))
      const categories: ReadonlyArray<CategorizeCategory> = (categoriesQ.data ?? []).map(c => ({
        id: c.id,
        name: c.name
      }))

      const enrichedNew = categorize({ rows: newRows, rules, bills, categories })

      const payload: ImportPayload = {
        accountId: selectedAccountId,
        accountName,
        adapterName: sourceLabel,
        parsedRows: enrichedNew,
        duplicateRows,
        skipped: skipped.map(s => ({ rowIndex: s.rowIndex, reason: s.reason }) satisfies SkippedReport),
        member: selectedMember
      }

      setStage({ kind: 'idle' })
      onParsed(payload)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to process file'
      setError({ message })
      setStage({ kind: 'idle' })
    }
  }

  const stageLabel = stageLabelFor(stage)

  return (
    <div className="rounded-xl border border-rule bg-surface p-6 shadow-sm space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Account</span>
          {accountsQ.isLoading ? (
            <p className="text-sm italic text-muted">Loading accounts…</p>
          ) : accountsQ.error ? (
            <p role="alert" className="text-sm text-red-700">
              Failed to load accounts: {accountsQ.error.message}
            </p>
          ) : (
            <select
              value={selectedAccountId}
              onChange={e => {
                setSelectedAccountId(e.target.value)
                resetStatus()
              }}
              disabled={isBusy}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
              aria-label="Account"
            >
              <option value="">Select an account…</option>
              {(accountsQ.data ?? []).map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Member</span>
          {membersQ.isLoading ? (
            <p className="text-sm italic text-muted">Loading members…</p>
          ) : membersQ.error ? (
            <p role="alert" className="text-sm text-red-700">
              Failed to load members: {membersQ.error.message}
            </p>
          ) : (
            <select
              value={selectedMember ?? MEMBER_UNASSIGNED_SENTINEL}
              onChange={e => {
                const raw = e.target.value
                setSelectedMember(raw === MEMBER_UNASSIGNED_SENTINEL ? null : raw)
                resetStatus()
              }}
              disabled={isBusy}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
              aria-label="Member"
            >
              {memberOptions.map(opt => (
                <option
                  key={opt.value ?? MEMBER_UNASSIGNED_SENTINEL}
                  value={opt.value ?? MEMBER_UNASSIGNED_SENTINEL}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.qfx,.ofx,application/x-ofx,application/x-qfx"
          onChange={handleFileChange}
          aria-label="CSV or QFX file"
          className="sr-only"
        />
        <button
          type="button"
          onClick={openFilePicker}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={!canAcceptFile}
          aria-disabled={!canAcceptFile}
          className={cn(
            'w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors',
            'flex flex-col items-center justify-center gap-3 text-sm',
            canAcceptFile
              ? 'cursor-pointer border-rule text-muted hover:border-brand hover:text-ink'
              : 'cursor-not-allowed border-rule text-muted opacity-60',
            isDragging && canAcceptFile && 'border-brand text-ink bg-brand/5'
          )}
        >
          {stage.kind === 'reading' || stage.kind === 'parsing' || stage.kind === 'dedup' || stage.kind === 'categorizing' ? (
            <>
              <Loader2 size={32} className="animate-spin text-brand" aria-hidden="true" />
              <span className="font-medium text-ink">{stageLabel}</span>
            </>
          ) : (
            <>
              <UploadCloud size={32} aria-hidden="true" />
              <span>
                {accountSelected
                  ? 'Drag a CSV or QFX here, or click to choose a file'
                  : 'Pick an account to enable upload (member is optional)'}
              </span>
            </>
          )}
        </button>
      </div>

      {warning && (
        <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warning}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 space-y-2">
          <p className="font-medium">{error.message}</p>
          {error.detail && <p className="text-xs text-red-700/80">{error.detail}</p>}
          <button
            type="button"
            onClick={() => resetStatus()}
            className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
          >
            Try another file
          </button>
        </div>
      )}
    </div>
  )
}

function stageLabelFor(stage: Stage): string {
  switch (stage.kind) {
    case 'reading':
      return stage.detail ? `Reading ${stage.detail}…` : 'Reading file…'
    case 'parsing':
      return stage.detail ? `Parsing ${stage.detail}…` : 'Parsing rows…'
    case 'dedup':
      return 'Checking for duplicates…'
    case 'categorizing':
      return 'Categorizing rows…'
    case 'idle':
      return ''
  }
}
