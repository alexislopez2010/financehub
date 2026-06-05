'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import type { AccountRow } from '@/lib/data/accounts'
import { useUpdateAccount } from '@/lib/data/accounts'
import { useHouseholdMembersList } from '@/lib/data/householdMembers'
import { IMPORT_FORMATS } from '@/lib/import/formats'
import { cn } from '@/lib/cn'

// Reserved literal for jointly-owned accounts. Lives next to the household
// member display names in the dropdown so the user can pick it like any
// other option.
const SHARED_OWNER = 'Shared'

const TYPES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'checking',   label: 'Checking' },
  { value: 'savings',    label: 'Savings' },
  { value: 'credit',     label: 'Credit card' },
  { value: 'loan',       label: 'Loan' },
  { value: 'investment', label: 'Investment' }
]

export interface EditAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountRow | null
}

export function EditAccountDialog({ open, onOpenChange, account }: EditAccountDialogProps) {
  const updateAccount = useUpdateAccount()
  const membersQ = useHouseholdMembersList()

  const [name, setName] = useState('')
  const [type, setType] = useState<string>('checking')
  const [institution, setInstitution] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [startingBalanceDate, setStartingBalanceDate] = useState('')
  const [owner, setOwner] = useState<string>('')
  const [importFormat, setImportFormat] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Sync form fields whenever a new account opens the dialog. We also reset
  // when the dialog closes so the next open starts clean.
  useEffect(() => {
    if (account && open) {
      setName(account.name)
      setType(account.type ?? 'checking')
      setInstitution(account.institution ?? '')
      setStartingBalance(
        account.starting_balance !== null && account.starting_balance !== undefined
          ? String(account.starting_balance)
          : ''
      )
      setStartingBalanceDate(account.starting_balance_date ?? '')
      setOwner(account.owner ?? '')
      setImportFormat(account.import_format ?? '')
      setSubmitError(null)
    }
  }, [account, open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!account) return
    setSubmitError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setSubmitError('Name is required.')
      return
    }

    const parsedStarting = parseFloat(startingBalance)
    if (!Number.isFinite(parsedStarting)) {
      setSubmitError('Starting balance must be a number.')
      return
    }

    try {
      await updateAccount.mutateAsync({
        id: account.id,
        patch: {
          name: trimmedName,
          type,
          institution: institution.trim() || null,
          starting_balance: parsedStarting,
          starting_balance_date: startingBalanceDate || null,
          owner: owner || null,
          import_format: importFormat || null
        }
      })
      onOpenChange(false)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update account')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[92vw] max-w-md max-h-[85vh] overflow-y-auto',
            'rounded-2xl bg-surface shadow-2xl'
          )}
        >
          <div className="sticky top-0 bg-surface border-b border-rule px-5 py-3 flex items-center justify-between">
            <Dialog.Title className="text-sm font-semibold text-ink">Edit account</Dialog.Title>
            <Dialog.Close className="text-muted hover:text-ink" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {submitError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {submitError}
              </div>
            )}

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Name</span>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <div>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Type</span>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <span className="block mt-1 text-[11px] text-muted">
                Changing type affects how balances are computed (cash vs debt).
              </span>
            </div>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Institution</span>
              <input
                type="text"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <div>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Owner</span>
                <select
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  disabled={membersQ.isLoading}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                >
                  <option value="">(unassigned)</option>
                  <option value={SHARED_OWNER}>Shared</option>
                  {(membersQ.data ?? []).map(m => (
                    <option key={m.user_id} value={m.display_name ?? ''}>
                      {m.display_name ?? '—'}
                    </option>
                  ))}
                </select>
              </label>
              <span className="block mt-1 text-[11px] text-muted">
                Who this account belongs to. Pick &ldquo;Shared&rdquo; for joint accounts.
              </span>
            </div>

            <div>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Import format</span>
                <select
                  value={importFormat}
                  onChange={e => setImportFormat(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">(no restriction)</option>
                  {IMPORT_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <span className="block mt-1 text-[11px] text-muted">
                When set, the Ledger import flow rejects any file whose detected format doesn&rsquo;t match.
                Leave at &ldquo;(no restriction)&rdquo; to accept anything.
              </span>
            </div>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Starting balance</span>
              <input
                type="number"
                step="0.01"
                required
                value={startingBalance}
                onChange={e => setStartingBalance(e.target.value)}
                className="w-full px-3 py-1.5 text-sm tabular text-right rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>

            <div>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wider text-muted block mb-1">Starting balance date</span>
                <input
                  type="date"
                  value={startingBalanceDate}
                  onChange={e => setStartingBalanceDate(e.target.value)}
                  placeholder="Optional — leave blank to count all activity."
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <span className="block mt-1 text-[11px] text-muted">
                When set, only transactions on or after this date count toward the current balance.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Dialog.Close className="px-3 py-1.5 text-sm text-muted hover:text-ink">Cancel</Dialog.Close>
              <button
                type="submit"
                disabled={updateAccount.isPending}
                className={cn(
                  'px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium',
                  'hover:bg-brand/90 disabled:opacity-60'
                )}
              >
                {updateAccount.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
