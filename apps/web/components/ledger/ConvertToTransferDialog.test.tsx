import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TransactionRow } from '@/lib/data/transactions'
import type { AccountRow } from '@/lib/data/accounts'

const mockPairMutate = vi.fn<(args: { rowAId: string; rowBId: string }, opts?: unknown) => void>()
const mockUsePair = vi.fn(() => ({
  mutate: mockPairMutate,
  isPending: false,
  error: null
}))
const mockUseAccounts = vi.fn<() => { data: ReadonlyArray<AccountRow> }>()

vi.mock('@/lib/data/transactions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/transactions')>('@/lib/data/transactions')
  return {
    ...actual,
    usePairTransferRows: () => mockUsePair()
  }
})

vi.mock('@/lib/data/accounts', async () => ({
  useAccounts: () => mockUseAccounts()
}))

import { ConvertToTransferDialog } from './ConvertToTransferDialog'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't-default',
    household_id: HOUSEHOLD,
    date: '2025-05-15',
    description: 'A transaction',
    amount: -100,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    account_id: 'acct-a',
    created_at: null,
    fingerprint: null,
    imported_at: null,
    member: null,
    notes: null,
    payment_method: null,
    sub_category: null,
    transfer_group_id: null,
    transfer_pair_id: null,
    ...over
  } as TransactionRow
}

function account(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'acct-a',
    household_id: HOUSEHOLD,
    name: 'Checking',
    type: 'checking',
    institution: null,
    display_order: null,
    is_active: true,
    created_at: null,
    archived_at: null,
    currency: null,
    last_four: null,
    starting_balance: null,
    starting_balance_date: null,
    ...over
  } as AccountRow
}

beforeEach(() => {
  mockPairMutate.mockReset()
  mockUsePair.mockReset()
  mockUsePair.mockReturnValue({ mutate: mockPairMutate, isPending: false, error: null })
  mockUseAccounts.mockReset()
  mockUseAccounts.mockReturnValue({
    data: [
      account({ id: 'acct-a', name: 'Checking' }),
      account({ id: 'acct-b', name: 'Savings' })
    ]
  })
})

describe('<ConvertToTransferDialog>', () => {
  it('renders the source row + candidate list with correct filtering', () => {
    const source = tx({ id: 'src', amount: -100, account_id: 'acct-a', date: '2025-05-15' })
    const candidates: ReadonlyArray<TransactionRow> = [
      // Match: other account, opposite sign, same magnitude, within ±5 days
      tx({ id: 'cand-ok', amount: 100, account_id: 'acct-b', date: '2025-05-16', description: 'Match me' }),
      // Same account → excluded
      tx({ id: 'cand-same-acct', amount: 100, account_id: 'acct-a', date: '2025-05-16', description: 'Same account' }),
      // Same sign → excluded
      tx({ id: 'cand-same-sign', amount: -100, account_id: 'acct-b', date: '2025-05-16', description: 'Same sign' }),
      // Different magnitude → excluded
      tx({ id: 'cand-diff-amt', amount: 200, account_id: 'acct-b', date: '2025-05-16', description: 'Diff amount' }),
      // Already paired → excluded
      tx({
        id: 'cand-paired',
        amount: 100,
        account_id: 'acct-b',
        date: '2025-05-16',
        description: 'Already paired',
        transfer_pair_id: 'other-anchor'
      }),
      // Out of window → excluded (default ±5 days)
      tx({ id: 'cand-far', amount: 100, account_id: 'acct-b', date: '2025-06-30', description: 'Too far' })
    ]

    render(
      <ConvertToTransferDialog
        open
        onOpenChange={() => {}}
        sourceTransaction={source}
        allTransactions={candidates}
      />
    )

    // Source row labelled and rendered
    expect(screen.getByText('From')).toBeInTheDocument()
    expect(screen.getByText('Checking')).toBeInTheDocument()

    // Only the matching candidate shows up
    expect(screen.getByText('Match me')).toBeInTheDocument()
    expect(screen.queryByText('Same account')).toBeNull()
    expect(screen.queryByText('Same sign')).toBeNull()
    expect(screen.queryByText('Diff amount')).toBeNull()
    expect(screen.queryByText('Already paired')).toBeNull()
    expect(screen.queryByText('Too far')).toBeNull()

    // Exactly one Pair button
    expect(screen.getAllByRole('button', { name: 'Pair' })).toHaveLength(1)
  })

  it('shows empty state when no candidates match', () => {
    const source = tx({ id: 'src', amount: -100, account_id: 'acct-a', date: '2025-05-15' })
    render(
      <ConvertToTransferDialog
        open
        onOpenChange={() => {}}
        sourceTransaction={source}
        allTransactions={[
          tx({ id: 'cand-same-acct', amount: 100, account_id: 'acct-a', date: '2025-05-16' })
        ]}
      />
    )

    expect(screen.getByText(/No matching transactions on other accounts/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pair' })).toBeNull()
  })

  it('calls usePairTransferRows.mutate with the source + candidate ids on Pair click', async () => {
    const user = userEvent.setup()
    const source = tx({ id: 'src', amount: -100, account_id: 'acct-a', date: '2025-05-15' })
    const candidate = tx({
      id: 'cand-ok',
      amount: 100,
      account_id: 'acct-b',
      date: '2025-05-16',
      description: 'Pair target'
    })

    render(
      <ConvertToTransferDialog
        open
        onOpenChange={() => {}}
        sourceTransaction={source}
        allTransactions={[candidate]}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Pair' }))

    expect(mockPairMutate).toHaveBeenCalledTimes(1)
    const callArgs = mockPairMutate.mock.calls[0]
    expect(callArgs?.[0]).toEqual({ rowAId: 'src', rowBId: 'cand-ok' })
  })

  it('uses the "Pair transfer" title when the source is already a Transfer', () => {
    const source = tx({
      id: 'src',
      type: 'Transfer',
      amount: -100,
      account_id: 'acct-a',
      date: '2025-05-15'
    })
    render(
      <ConvertToTransferDialog
        open
        onOpenChange={() => {}}
        sourceTransaction={source}
        allTransactions={[]}
      />
    )

    expect(screen.getByText('Pair transfer')).toBeInTheDocument()
    expect(screen.getByText(/This transfer isn't linked yet/i)).toBeInTheDocument()
    expect(screen.queryByText('Convert to transfer')).toBeNull()
  })

  it('uses the "Convert to transfer" title when the source is not yet a Transfer', () => {
    const source = tx({ id: 'src', type: 'Expense', amount: -100, account_id: 'acct-a' })
    render(
      <ConvertToTransferDialog
        open
        onOpenChange={() => {}}
        sourceTransaction={source}
        allTransactions={[]}
      />
    )

    expect(screen.getByText('Convert to transfer')).toBeInTheDocument()
    expect(screen.queryByText('Pair transfer')).toBeNull()
  })
})
