'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useMemo, useState } from 'react'
import { X, ArrowRightLeft } from 'lucide-react'
import type { TransactionRow } from '@/lib/data/transactions'
import { usePairTransferRows } from '@/lib/data/transactions'
import { useAccounts, type AccountRow } from '@/lib/data/accounts'
import { cn } from '@/lib/cn'

export interface ConvertToTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceTransaction: TransactionRow | null
  allTransactions: ReadonlyArray<TransactionRow>
}

const DATE_WINDOWS: ReadonlyArray<number> = [5, 10, 30]

const MONTH_ABBR: ReadonlyArray<string> = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const month = MONTH_ABBR[parseInt(m[2]!, 10) - 1] ?? ''
  const day = parseInt(m[3]!, 10)
  return `${month} ${day}`
}

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function amountTone(amount: number): string {
  if (amount < 0) return 'text-red-600'
  if (amount > 0) return 'text-emerald-600'
  return 'text-muted'
}

function signedAmount(amount: number): string {
  const sign = amount < 0 ? '−' : amount > 0 ? '+' : ''
  return `${sign}${formatUSD(Math.abs(amount))}`
}

interface CandidateRowDisplay {
  readonly tx: TransactionRow
  readonly accountName: string
  readonly diffDays: number
}

function resolveAccountName(
  accountId: string | null,
  fallback: string | null,
  accounts: ReadonlyArray<AccountRow>
): string {
  if (accountId) {
    const hit = accounts.find(a => a.id === accountId)
    if (hit) return hit.name
  }
  return fallback ?? 'Unknown account'
}

export function ConvertToTransferDialog({
  open,
  onOpenChange,
  sourceTransaction,
  allTransactions
}: ConvertToTransferDialogProps) {
  const accountsQ = useAccounts()
  const pairMutation = usePairTransferRows()

  const [dateWindow, setDateWindow] = useState<number>(5)
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accounts: ReadonlyArray<AccountRow> = accountsQ.data ?? []

  const candidates: ReadonlyArray<CandidateRowDisplay> = useMemo(() => {
    if (!sourceTransaction) return []
    const srcMs = new Date(sourceTransaction.date).getTime()
    const srcAbs = Math.abs(sourceTransaction.amount)
    const srcSign = Math.sign(sourceTransaction.amount)
    const windowMs = dateWindow * 24 * 60 * 60 * 1000

    return allTransactions
      .filter(t => t.id !== sourceTransaction.id)
      .filter(t => t.account_id != null && t.account_id !== sourceTransaction.account_id)
      .filter(t => t.transfer_pair_id == null)
      .filter(t => Math.abs(t.amount) === srcAbs)
      .filter(t => Math.sign(t.amount) !== srcSign)
      .filter(t => Math.abs(new Date(t.date).getTime() - srcMs) <= windowMs)
      .map(t => ({
        tx: t,
        accountName: resolveAccountName(t.account_id, t.account, accounts),
        diffDays: Math.abs(new Date(t.date).getTime() - srcMs) / (24 * 60 * 60 * 1000)
      }))
      .sort((a, b) => a.diffDays - b.diffDays)
  }, [allTransactions, sourceTransaction, dateWindow, accounts])

  // Reset transient UI state when the dialog (re-)opens with a new source.
  const sourceId = sourceTransaction?.id ?? null
  const [lastSourceId, setLastSourceId] = useState<string | null>(null)
  if (sourceId !== lastSourceId) {
    setLastSourceId(sourceId)
    setDateWindow(5)
    setPendingCandidateId(null)
    setError(null)
  }

  function handlePair(candidateId: string) {
    if (!sourceTransaction) return
    setError(null)
    setPendingCandidateId(candidateId)
    pairMutation.mutate(
      { rowAId: sourceTransaction.id, rowBId: candidateId },
      {
        onSuccess() {
          setPendingCandidateId(null)
          onOpenChange(false)
        },
        onError(err: Error) {
          setPendingCandidateId(null)
          setError(err.message)
        }
      }
    )
  }

  if (!sourceTransaction) {
    return <></>
  }

  const sourceAccountName = resolveAccountName(
    sourceTransaction.account_id,
    sourceTransaction.account,
    accounts
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-[92vw] max-w-lg max-h-[85vh] overflow-y-auto',
          'rounded-2xl bg-surface shadow-2xl'
        )}>
          <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-brand" />
              <Dialog.Title className="text-sm font-semibold text-ink">Convert to transfer</Dialog.Title>
            </div>
            <Dialog.Close className="text-muted hover:text-ink"><X size={18} /></Dialog.Close>
          </div>

          <div className="px-5 py-4 space-y-4">
            <Dialog.Description className="text-xs text-muted">
              Pair this transaction with a matching counterpart on another account.
            </Dialog.Description>

            {/* Source row card */}
            <section aria-labelledby="convert-source-label" className="rounded-lg border border-rule bg-bg p-3">
              <div id="convert-source-label" className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                From
              </div>
              <div className="grid grid-cols-[60px_1fr_auto] items-center gap-3">
                <div className="text-xs text-muted tabular">{formatShortDate(sourceTransaction.date)}</div>
                <div className="min-w-0">
                  <div className="text-sm text-ink truncate" title={sourceTransaction.description ?? ''}>
                    {sourceTransaction.description ?? '(no description)'}
                  </div>
                  <div className="text-xs text-muted truncate">{sourceAccountName}</div>
                </div>
                <div className={cn('text-right tabular text-sm font-medium', amountTone(sourceTransaction.amount))}>
                  {signedAmount(sourceTransaction.amount)}
                </div>
              </div>
            </section>

            {/* Date range chips */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Window:</span>
              <div className="flex gap-2 text-xs">
                {DATE_WINDOWS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDateWindow(d)}
                    aria-pressed={dateWindow === d}
                    className={cn(
                      'rounded-full px-3 py-1 transition',
                      dateWindow === d
                        ? 'bg-brand text-white'
                        : 'bg-bg text-muted hover:bg-rule'
                    )}
                  >
                    ±{d} days
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Candidate list */}
            <section aria-label="Candidate transactions">
              {candidates.length === 0 ? (
                <p className="italic text-sm text-muted py-6 text-center">
                  No matching transactions on other accounts within ±{dateWindow} days. Try widening the date range.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 border border-rule rounded-lg overflow-hidden">
                  {candidates.map(({ tx, accountName }) => {
                    const isPending = pairMutation.isPending && pendingCandidateId === tx.id
                    return (
                      <li
                        key={tx.id}
                        className="grid grid-cols-[60px_1fr_auto_80px] items-center gap-3 px-3 py-2 text-sm"
                      >
                        <div className="text-xs text-muted tabular">{formatShortDate(tx.date)}</div>
                        <div className="min-w-0">
                          <div className="text-ink truncate" title={tx.description ?? ''}>
                            {tx.description ?? '(no description)'}
                          </div>
                          <div className="text-xs text-muted truncate">{accountName}</div>
                        </div>
                        <div className={cn('text-right tabular font-medium', amountTone(tx.amount))}>
                          {signedAmount(tx.amount)}
                        </div>
                        <div className="text-right">
                          <button
                            type="button"
                            onClick={() => handlePair(tx.id)}
                            disabled={pairMutation.isPending}
                            className={cn(
                              'px-3 py-1 rounded-md text-xs font-medium',
                              'bg-brand text-white hover:bg-brand/90 disabled:opacity-60'
                            )}
                          >
                            {isPending ? 'Pairing…' : 'Pair'}
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>

          <div className="border-t border-rule px-5 py-3 flex justify-end">
            <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
