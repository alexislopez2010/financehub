import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Hook mocks — declared as factory closures so we can swap return values per test.
const accountsMock = vi.fn()
const billsMock = vi.fn()
const billMatchRulesMock = vi.fn()
const categoriesMock = vi.fn()

vi.mock('@/lib/data/accounts', () => ({
  useAccounts: () => accountsMock()
}))
vi.mock('@/lib/data/bills', () => ({
  useBills: () => billsMock()
}))
vi.mock('@/lib/data/billMatchRules', () => ({
  useBillMatchRules: () => billMatchRulesMock()
}))
vi.mock('@/lib/data/categories', () => ({
  useCategories: () => categoriesMock()
}))

// Supabase fetch returns no pre-existing fingerprints by default.
const supabaseFingerprintData = { rows: [] as Array<{ fingerprint: string | null }> }

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    from: (_table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        gte: () => builder,
        lte: () => builder,
        not: () => Promise.resolve({ data: supabaseFingerprintData.rows, error: null })
      }
      return builder
    }
  })
}))

import { UploadStep } from './UploadStep'

function withQueryClient(ui: ReactNode): ReactNode {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  })
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>
}

function setReady(): void {
  accountsMock.mockReturnValue({
    data: [{ id: 'acc-1', name: 'Chase Checking' }],
    isLoading: false,
    error: null
  })
  billsMock.mockReturnValue({ data: [], isLoading: false, error: null })
  billMatchRulesMock.mockReturnValue({ data: [], isLoading: false, error: null })
  categoriesMock.mockReturnValue({ data: [], isLoading: false, error: null })
}

beforeEach(() => {
  accountsMock.mockReset()
  billsMock.mockReset()
  billMatchRulesMock.mockReset()
  categoriesMock.mockReset()
  supabaseFingerprintData.rows = []
  setReady()
})

describe('<UploadStep>', () => {
  it('renders the account dropdown with each available account', () => {
    render(withQueryClient(<UploadStep onParsed={() => {}} />))
    const select = screen.getByLabelText('Account') as HTMLSelectElement
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Chase Checking' })).toBeInTheDocument()
  })

  it('shows a loading hint while accounts are loading', () => {
    accountsMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(withQueryClient(<UploadStep onParsed={() => {}} />))
    expect(screen.getByText(/loading accounts/i)).toBeInTheDocument()
  })

  it('disables the dropzone until an account is selected', async () => {
    const user = userEvent.setup()
    render(withQueryClient(<UploadStep onParsed={() => {}} />))
    const dropzone = screen.getByRole('button')
    expect(dropzone).toBeDisabled()
    expect(dropzone).toHaveTextContent(/pick an account first/i)
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')
    expect(dropzone).not.toBeDisabled()
    expect(dropzone).toHaveTextContent(/drag a csv here/i)
  })

  it('processes a valid Chase CSV and calls onParsed with a payload', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))

    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    const csvText = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '04/12/2026,04/13/2026,STARBUCKS #4321,Food & Drink,Sale,-5.75,',
      '04/15/2026,04/16/2026,NETFLIX.COM,Subscriptions,Sale,-15.99,'
    ].join('\n')
    const file = new File([csvText], 'chase.csv', { type: 'text/csv' })

    const fileInput = screen.getByLabelText('CSV file') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1))
    const payload = onParsed.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      adapterName: 'Chase'
    })
    expect(payload.parsedRows.length).toBe(2)
    expect(payload.duplicateRows.length).toBe(0)
  })

  it('shows an error for an unrecognized CSV format', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))

    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    const csvText = 'Foo,Bar\n1,2\n'
    const file = new File([csvText], 'unknown.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('CSV file'), file)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unrecognized csv format/i)
    })
    expect(onParsed).not.toHaveBeenCalled()
  })
})
