'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Wallet } from 'lucide-react'
import { useAccounts, useCreateAccount, useUpdateAccount } from '@/lib/data/accounts'
import { useTransactions } from '@/lib/data/transactions'
import { deriveBalances } from '@/lib/accounts/balances'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { KpiTile } from '@/components/ui/KpiTile'
import { AccountRow } from './AccountRow'
import { AddAccountForm } from './AddAccountForm'
import { EditAccountDialog } from './EditAccountDialog'

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export function AccountsSection() {
  const accountsQ = useAccounts()
  // No date filter — we need ALL transactions for accurate per-account balance.
  const txsQ = useTransactions()
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()

  const [showAddForm, setShowAddForm] = useState(false)
  const [editTargetId, setEditTargetId] = useState<string | null>(null)

  const summary = useMemo(
    () => deriveBalances({
      accounts: accountsQ.data ?? [],
      transactions: txsQ.data ?? []
    }),
    [accountsQ.data, txsQ.data]
  )

  // Look up the full account row for the dialog by id. We keep the row state
  // outside of edit state so cache updates refresh the dialog data too.
  const editTarget = useMemo(() => {
    if (!editTargetId) return null
    return accountsQ.data?.find(a => a.id === editTargetId) ?? null
  }, [editTargetId, accountsQ.data])

  const searchParams = useSearchParams()
  const focusId = searchParams?.get('focus') ?? null

  // Spotlight deep link: scroll the focused account row into view once it renders.
  useEffect(() => {
    if (!focusId) return
    if (typeof document === 'undefined') return
    if (!summary.accounts.some(a => a.accountId === focusId)) return
    const el = document.querySelector<HTMLElement>(`[data-account-id="${CSS.escape(focusId)}"]`)
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusId, summary.accounts])

  function handleCreate(input: { name: string; type: string; institution: string | null; starting_balance: number }) {
    createAccount.mutate({
      household_id: LOPEZ_HOUSEHOLD_ID,
      name: input.name,
      type: input.type,
      institution: input.institution,
      starting_balance: input.starting_balance,
      is_active: true,
      currency: 'USD'
    })
    setShowAddForm(false)
  }

  function handleEditName(id: string, next: string) {
    updateAccount.mutate({ id, patch: { name: next } })
  }

  function handleArchive(id: string, name: string) {
    if (typeof window !== 'undefined' && !window.confirm(`Archive account "${name}"? It will be hidden from balances but transactions remain intact.`)) return
    updateAccount.mutate({ id, patch: { is_active: false, archived_at: new Date().toISOString() } })
  }

  const isLoading = accountsQ.isLoading || txsQ.isLoading
  const error = accountsQ.error || txsQ.error

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile label="Cash" value={formatUSD(summary.totalCash)} icon={Wallet} iconTone="blue" />
        <KpiTile label="Debt" value={formatUSD(summary.totalDebt)} icon={Wallet} iconTone="red" />
        <KpiTile label="Investments" value={formatUSD(summary.totalInvestments)} icon={Wallet} iconTone="purple" />
        <KpiTile
          label="Net Worth"
          value={formatUSD(summary.netWorth)}
          icon={Wallet}
          iconTone={summary.netWorth >= 0 ? 'emerald' : 'red'}
          captionTone={summary.netWorth >= 0 ? 'positive' : 'negative'}
          caption={summary.netWorth >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
        <header className="px-4 py-3 border-b border-rule flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Accounts</h2>
            <p className="text-xs text-muted">Current balance = starting + activity to date</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-medium hover:bg-brand/90"
          >
            <Plus size={12} />
            Add account
          </button>
        </header>

        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
        ) : error ? (
          <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
            Failed to load: {error.message}
          </div>
        ) : (
          <>
            {showAddForm && (
              <AddAccountForm
                isSubmitting={createAccount.isPending}
                onSubmit={handleCreate}
                onCancel={() => setShowAddForm(false)}
              />
            )}
            {summary.accounts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted">No active accounts.</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {summary.accounts.map(b => (
                  <li key={b.accountId} className="group">
                    <AccountRow
                      balance={b}
                      onEditName={(next) => handleEditName(b.accountId, next)}
                      onEdit={() => setEditTargetId(b.accountId)}
                      onArchive={() => handleArchive(b.accountId, b.name)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <EditAccountDialog
        open={editTarget !== null}
        onOpenChange={(o) => { if (!o) setEditTargetId(null) }}
        account={editTarget}
      />
    </div>
  )
}
