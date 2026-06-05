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
const membersMock = vi.fn()

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
vi.mock('@/lib/data/householdMembers', () => ({
  useHouseholdMembersList: () => membersMock()
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

function setReady(over?: { accountImportFormat?: string | null }): void {
  accountsMock.mockReturnValue({
    data: [{
      id: 'acc-1',
      name: 'Chase Checking',
      import_format: over?.accountImportFormat ?? null
    }],
    isLoading: false,
    error: null
  })
  billsMock.mockReturnValue({ data: [], isLoading: false, error: null })
  billMatchRulesMock.mockReturnValue({ data: [], isLoading: false, error: null })
  categoriesMock.mockReturnValue({ data: [], isLoading: false, error: null })
  membersMock.mockReturnValue({
    data: [
      { user_id: 'u-1', display_name: 'Alexis Lopez', role: 'owner' },
      { user_id: 'u-2', display_name: 'Marilyn Lopez', role: 'member' }
    ],
    isLoading: false,
    error: null
  })
}

beforeEach(() => {
  accountsMock.mockReset()
  billsMock.mockReset()
  billMatchRulesMock.mockReset()
  categoriesMock.mockReset()
  membersMock.mockReset()
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
    expect(dropzone).toHaveTextContent(/pick an account to enable upload/i)
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')
    expect(dropzone).not.toBeDisabled()
    expect(dropzone).toHaveTextContent(/drag a csv or qfx here/i)
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

    const fileInput = screen.getByLabelText('CSV or QFX file') as HTMLInputElement
    await user.upload(fileInput, file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1))
    const payload = onParsed.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      adapterName: 'Chase',
      member: null
    })
    expect(payload.parsedRows.length).toBe(2)
    expect(payload.duplicateRows.length).toBe(0)
  })

  it('renders the member dropdown with members + Family + Unassigned options', () => {
    render(withQueryClient(<UploadStep onParsed={() => {}} />))
    const memberSelect = screen.getByLabelText('Member') as HTMLSelectElement
    expect(memberSelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '(Unassigned)' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Family' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alexis Lopez' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Marilyn Lopez' })).toBeInTheDocument()
  })

  it('forwards the selected member through the payload', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))

    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')
    await user.selectOptions(screen.getByLabelText('Member'), 'Marilyn Lopez')

    const csvText = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '04/12/2026,04/13/2026,STARBUCKS #4321,Food & Drink,Sale,-5.75,'
    ].join('\n')
    const file = new File([csvText], 'chase.csv', { type: 'text/csv' })

    await user.upload(screen.getByLabelText('CSV or QFX file'), file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1))
    expect(onParsed.mock.calls[0]?.[0]?.member).toBe('Marilyn Lopez')
  })

  it('keeps dropzone enabled when account is set even if member stays unassigned', async () => {
    const user = userEvent.setup()
    render(withQueryClient(<UploadStep onParsed={() => {}} />))
    const dropzone = screen.getByRole('button')
    expect(dropzone).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')
    // Member is left at default '(Unassigned)' (null).
    expect(dropzone).not.toBeDisabled()
  })

  it('processes a PayPal QFX file via the OFX path and calls onParsed', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))

    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    // Minimal QFX with one DEBIT and one CREDIT-looking-like-a-payment.
    const qfxText = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<SIGNONMSGSRSV1><SONRS><FI><ORG>SYNCB</FI></SONRS></SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CCACCTFROM><ACCTID>6044191028569715</CCACCTFROM>
<BANKTRANLIST>
<DTSTART>20251205
<DTEND>20260105
<STMTTRN>
<TRNTYPE>DEBIT
<DTUSER>20251107
<TRNAMT>-96.0
<FITID>11072025253009600313502065223209
<NAME>Purchase
<MEMO>P9283009TEHM6DLN7
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTUSER>20251128
<TRNAMT>200.0
<FITID>11282025271020000000000000000000
<NAME>Auto pay
<MEMO>F928300AC00CHGDDA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>-192.05<DTASOF>20260605</LEDGERBAL>
</CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>
`
    const file = new File([qfxText], 'Transaction.qfx', { type: 'application/x-qfx' })

    await user.upload(screen.getByLabelText('CSV or QFX file'), file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1))
    const payload = onParsed.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      accountId: 'acc-1',
      adapterName: expect.stringMatching(/SYNCB QFX/)
    })
    expect(payload.parsedRows.length).toBe(2)
    // QFX preserves the sign convention exactly.
    const purchase = payload.parsedRows.find((r: { amount: number }) => r.amount === -96)
    const autopay = payload.parsedRows.find((r: { amount: number }) => r.amount === 200)
    expect(purchase?.type).toBe('Expense')
    expect(autopay?.type).toBe('Income')
  })

  it('rejects a QFX upload when the account is locked to a CSV format', async () => {
    setReady({ accountImportFormat: 'Chase' })
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    const qfxText = `OFXHEADER:100
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
<CCACCTFROM><ACCTID>123</CCACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTUSER>20251107<TRNAMT>-5<FITID>x<NAME>Purchase</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`
    const file = new File([qfxText], 'paypal.qfx', { type: 'application/x-qfx' })
    await user.upload(screen.getByLabelText('CSV or QFX file'), file)

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/only accepts chase imports/i)
    )
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('rejects a CSV from a different bank when the account is locked to one adapter', async () => {
    setReady({ accountImportFormat: 'Citibank' })
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    // Valid Chase CSV — would normally succeed, but the account demands Citibank.
    const csvText = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '04/12/2026,04/13/2026,STARBUCKS,Food & Drink,Sale,-5.75,'
    ].join('\n')
    const file = new File([csvText], 'chase.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('CSV or QFX file'), file)

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(/only accepts citibank imports/i)
      expect(alert).toHaveTextContent(/detected a chase csv/i)
    })
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('accepts a CSV when the account is locked to that exact adapter', async () => {
    setReady({ accountImportFormat: 'Chase' })
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))
    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    const csvText = [
      'Transaction Date,Post Date,Description,Category,Type,Amount,Memo',
      '04/12/2026,04/13/2026,STARBUCKS,Food & Drink,Sale,-5.75,'
    ].join('\n')
    const file = new File([csvText], 'chase.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('CSV or QFX file'), file)

    await waitFor(() => expect(onParsed).toHaveBeenCalledTimes(1))
  })

  it('shows an error for an unrecognized CSV format', async () => {
    const user = userEvent.setup()
    const onParsed = vi.fn()
    render(withQueryClient(<UploadStep onParsed={onParsed} />))

    await user.selectOptions(screen.getByLabelText('Account'), 'acc-1')

    const csvText = 'Foo,Bar\n1,2\n'
    const file = new File([csvText], 'unknown.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('CSV or QFX file'), file)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/unrecognized csv format/i)
    })
    expect(onParsed).not.toHaveBeenCalled()
  })
})
