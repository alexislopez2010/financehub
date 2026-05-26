import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ImportRow } from '@/lib/import/adapters/types'
import type { ImportPayload } from './ImportFlow'

// Mock data hooks + supabase + insert helper.
const categoriesMock = vi.fn()
vi.mock('@/lib/data/categories', () => ({
  useCategories: () => categoriesMock()
}))

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({})
}))

const insertMock = vi.fn()
vi.mock('@/lib/import/insert', () => ({
  insertImportedTransactions: (...args: unknown[]) => insertMock(...args)
}))

import { PreviewStep } from './PreviewStep'

function makeRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    date: '2026-05-21',
    description: 'TEST DESC',
    amount: -12.34,
    type: 'Expense',
    categoryId: null,
    billId: null,
    fingerprint: 'fp-' + Math.random().toString(36).slice(2, 10),
    source: 'chase',
    ...overrides
  }
}

function makePayload(overrides: Partial<ImportPayload> = {}): ImportPayload {
  return {
    accountId: 'acc-1',
    accountName: 'Chase Checking',
    adapterName: 'Chase',
    parsedRows: [],
    duplicateRows: [],
    skipped: [],
    member: null,
    ...overrides
  }
}

beforeEach(() => {
  categoriesMock.mockReset()
  categoriesMock.mockReturnValue({
    data: [{ id: 'cat-1', name: 'Subscriptions' }],
    isLoading: false,
    error: null
  })
  insertMock.mockReset()
})

describe('<PreviewStep>', () => {
  it('renders summary tiles, preview rows, and the import button', () => {
    const payload = makePayload({
      parsedRows: [
        makeRow({ description: 'STARBUCKS', amount: -5.75, categoryId: 'cat-1' }),
        makeRow({ description: 'NETFLIX', amount: -15.99 })
      ],
      duplicateRows: [makeRow({ description: 'DUPE' })]
    })
    render(<PreviewStep payload={payload} onBack={() => {}} onComplete={() => {}} />)

    // Summary tiles
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Skipped duplicates')).toBeInTheDocument()
    expect(screen.getByText('Categorized')).toBeInTheDocument()

    // Rows
    expect(screen.getByText('STARBUCKS')).toBeInTheDocument()
    expect(screen.getByText('NETFLIX')).toBeInTheDocument()
    // Resolved category name + Uncategorized placeholder
    expect(screen.getByText('Subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()

    // Import button
    expect(
      screen.getByRole('button', { name: /import 2 transactions/i })
    ).toBeInTheDocument()
  })

  it('calls onBack when the back button is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const payload = makePayload({ parsedRows: [makeRow()] })
    render(<PreviewStep payload={payload} onBack={onBack} onComplete={() => {}} />)

    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('invokes the insert helper and forwards the result to onComplete', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    const fakeResult = { inserted: 1, failed: [] as ReadonlyArray<never> }
    insertMock.mockResolvedValueOnce(fakeResult)

    const row = makeRow({ description: 'STARBUCKS', amount: -5.75 })
    const payload = makePayload({ parsedRows: [row] })

    render(<PreviewStep payload={payload} onBack={() => {}} onComplete={onComplete} />)

    await user.click(screen.getByRole('button', { name: /import 1 transaction/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(onComplete).toHaveBeenCalledWith(fakeResult)
    expect(insertMock).toHaveBeenCalledTimes(1)
    const args = insertMock.mock.calls[0]?.[0] as {
      rows: ReadonlyArray<ImportRow>
      accountId: string
      accountName: string
    }
    expect(args.rows).toHaveLength(1)
    expect(args.accountId).toBe('acc-1')
    expect(args.accountName).toBe('Chase Checking')
  })

  it('toggles the skipped duplicates list', async () => {
    const user = userEvent.setup()
    const payload = makePayload({
      parsedRows: [makeRow({ description: 'NEW ROW' })],
      duplicateRows: [makeRow({ description: 'DUPE ROW' })]
    })
    render(<PreviewStep payload={payload} onBack={() => {}} onComplete={() => {}} />)

    expect(screen.queryByText('DUPE ROW')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show skipped duplicates/i }))
    expect(screen.getByText('DUPE ROW')).toBeInTheDocument()
  })

  it('renders the all-rows-skipped empty state when parsedRows is empty and skipped rows exist', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    const payload = makePayload({
      adapterName: 'Citibank',
      parsedRows: [],
      skipped: [
        { rowIndex: 0, reason: 'unparseable date' },
        { rowIndex: 1, reason: 'missing description' }
      ]
    })
    render(<PreviewStep payload={payload} onBack={onBack} onComplete={() => {}} />)

    expect(screen.getByText(/all rows skipped/i)).toBeInTheDocument()
    expect(
      screen.getByText(/the citibank adapter found 2 rows but couldn't parse any of them/i)
    ).toBeInTheDocument()
    // Skip detail list is rendered and open by default. Anchor on the row
    // labels because the reason text "missing description" also appears in
    // the explainer paragraph above.
    expect(screen.getByText(/unparseable date/i)).toBeInTheDocument()
    expect(screen.getAllByText(/missing description/i).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/^row 1$/)).toBeInTheDocument()
    expect(screen.getByText(/^row 2$/)).toBeInTheDocument()

    // No normal preview UI / no sticky Import bar.
    expect(screen.queryByText('New')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /import \d+ transaction/i })).not.toBeInTheDocument()

    // Back button works.
    await user.click(screen.getByRole('button', { name: /back to upload/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders the empty state without a skip-detail list when no skipped rows', () => {
    const payload = makePayload({
      adapterName: 'Chase',
      parsedRows: [],
      skipped: []
    })
    render(<PreviewStep payload={payload} onBack={() => {}} onComplete={() => {}} />)

    expect(screen.getByText(/all rows skipped/i)).toBeInTheDocument()
    expect(
      screen.getByText(/the chase adapter found 0 rows but couldn't parse any of them/i)
    ).toBeInTheDocument()
    // No skip list summary / no skip list items.
    expect(screen.queryByText(/skipped rows?$/i)).not.toBeInTheDocument()
    // Still has a Back button.
    expect(screen.getByRole('button', { name: /back to upload/i })).toBeInTheDocument()
  })

  it('renders the normal preview UI when parsedRows has items (sanity check)', () => {
    const payload = makePayload({
      parsedRows: [makeRow({ description: 'NORMAL ROW' })]
    })
    render(<PreviewStep payload={payload} onBack={() => {}} onComplete={() => {}} />)

    // Normal preview elements present.
    expect(screen.getByText('NORMAL ROW')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /import 1 transaction/i })).toBeInTheDocument()
    // Empty-state heading absent.
    expect(screen.queryByText(/all rows skipped/i)).not.toBeInTheDocument()
  })
})
