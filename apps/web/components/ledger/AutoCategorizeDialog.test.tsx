import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TransactionRow } from '@/lib/data/transactions'
import type { CategoryRow } from '@/lib/data/categories'
import type { BillMatchRuleRow } from '@/lib/data/billMatchRules'
import type { BillRow } from '@/lib/data/bills'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

const mockUpdateMutate = vi.fn(async (_args: { id: string; patch: Record<string, unknown> }) => undefined)
const mockUseUpdateTransaction = vi.fn(() => ({ mutateAsync: mockUpdateMutate }))

const mockUseTransactions = vi.fn<() => {
  data: ReadonlyArray<TransactionRow>
  isLoading: boolean
}>()
const mockUseCategories = vi.fn<() => {
  data: ReadonlyArray<CategoryRow>
  isLoading: boolean
}>()
const mockUseBillMatchRules = vi.fn<() => {
  data: ReadonlyArray<BillMatchRuleRow>
  isLoading: boolean
}>()
const mockUseBills = vi.fn<() => {
  data: ReadonlyArray<BillRow>
  isLoading: boolean
}>()

vi.mock('@/lib/data/transactions', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/transactions')>('@/lib/data/transactions')
  return {
    ...actual,
    useTransactions: () => mockUseTransactions(),
    useUpdateTransaction: () => mockUseUpdateTransaction()
  }
})

vi.mock('@/lib/data/categories', async () => ({
  useCategories: () => mockUseCategories()
}))

vi.mock('@/lib/data/billMatchRules', async () => ({
  useBillMatchRules: () => mockUseBillMatchRules()
}))

vi.mock('@/lib/data/bills', async () => ({
  useBills: () => mockUseBills()
}))

import { AutoCategorizeDialog } from './AutoCategorizeDialog'

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't',
    household_id: HOUSEHOLD,
    date: '2025-05-15',
    description: '',
    amount: -10,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    account_id: null,
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

function cat(id: string, name: string): CategoryRow {
  return {
    id,
    household_id: HOUSEHOLD,
    name,
    type: 'expense',
    parent_category: null,
    is_fixed: null,
    created_at: null
  } as CategoryRow
}

const CATEGORIES: ReadonlyArray<CategoryRow> = [
  cat('cat-food', 'Food & Dining'),
  cat('cat-trans', 'Transportation'),
  cat('cat-shop', 'Shopping')
]

beforeEach(() => {
  mockUpdateMutate.mockReset()
  mockUpdateMutate.mockImplementation(async () => undefined)
  mockUseUpdateTransaction.mockReset()
  mockUseUpdateTransaction.mockReturnValue({ mutateAsync: mockUpdateMutate })
  mockUseTransactions.mockReset()
  mockUseCategories.mockReset()
  mockUseBillMatchRules.mockReset()
  mockUseBills.mockReset()
  mockUseCategories.mockReturnValue({ data: CATEGORIES, isLoading: false })
  mockUseBillMatchRules.mockReturnValue({ data: [], isLoading: false })
  mockUseBills.mockReturnValue({ data: [], isLoading: false })
})

describe('<AutoCategorizeDialog>', () => {
  it('renders summary tiles + group table when open with uncategorized txs', () => {
    mockUseTransactions.mockReturnValue({
      data: [
        // Two rows with the same normalized merchant → dictionary → Food & Dining
        tx({ id: 't1', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't2', description: 'STARBUCKS COFFEE' }),
        // One SHELL row → dictionary → Transportation
        tx({ id: 't3', description: 'SHELL OIL' })
      ],
      isLoading: false
    })

    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)

    expect(screen.getByText('Auto-categorize transactions')).toBeInTheDocument()
    // Summary tiles
    expect(screen.getByText('Have suggestion')).toBeInTheDocument()
    expect(screen.getByText('No suggestion')).toBeInTheDocument()
    expect(screen.getByText('Selected to apply')).toBeInTheDocument()

    // Both merchant groups visible (text may also appear in the sample line)
    expect(screen.getAllByText('STARBUCKS COFFEE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('SHELL OIL').length).toBeGreaterThan(0)

    // 2 groups by default seeded as selected → 3 txs total (2 STARBUCKS + 1 SHELL)
    // Footer summary text (the <p> mixes plain text + bold span counts).
    const footer = screen.getByText(/Will categorize/i)
    expect(footer.textContent).toBe('Will categorize 3 transactions in 2 groups.')
  })

  it('shows analyzing state while data is loading', () => {
    mockUseTransactions.mockReturnValue({ data: [], isLoading: true })
    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)
    expect(screen.getByText(/Analyzing transactions/i)).toBeInTheDocument()
  })

  it('excludes a group from the total when its checkbox is toggled off', async () => {
    const user = userEvent.setup()
    mockUseTransactions.mockReturnValue({
      data: [
        tx({ id: 't1', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't2', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't3', description: 'SHELL OIL' })
      ],
      isLoading: false
    })

    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)

    function footerText(): string | null {
      const footer = screen.getByText(/Will categorize/i)
      return footer.textContent
    }

    // Initially: 3 txs in 2 groups
    expect(footerText()).toBe('Will categorize 3 transactions in 2 groups.')

    const starbucksCheckbox = screen.getByRole('checkbox', { name: /Include STARBUCKS COFFEE in apply/i })
    await user.click(starbucksCheckbox)

    // After unselecting STARBUCKS (2 txs) → only SHELL (1 tx) left
    await waitFor(() => {
      expect(footerText()).toBe('Will categorize 1 transaction in 1 group.')
    })
  })

  it('disables the Apply button when no groups have a suggestion + nothing is selected', () => {
    // STARBUCKZ doesn't match anything in dictionary → confidence='none'
    mockUseTransactions.mockReturnValue({
      data: [tx({ id: 't1', description: 'WEIRD UNKNOWN MERCHANT 123' })],
      isLoading: false
    })
    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)
    const applyBtn = screen.getByRole('button', { name: /^Apply$/ })
    expect(applyBtn).toBeDisabled()
  })

  it('updates local state when a group category dropdown is changed', async () => {
    const user = userEvent.setup()
    mockUseTransactions.mockReturnValue({
      data: [
        tx({ id: 't1', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't2', description: 'STARBUCKS COFFEE' })
      ],
      isLoading: false
    })
    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)

    const select = screen.getByRole('combobox', { name: /Category for STARBUCKS COFFEE/i }) as HTMLSelectElement
    // Default suggestion = Food & Dining (cat-food)
    expect(select.value).toBe('cat-food')

    await user.selectOptions(select, 'cat-shop')
    expect(select.value).toBe('cat-shop')
  })

  it('calls useUpdateTransaction.mutateAsync for each tx in selected groups when Apply is clicked', async () => {
    const user = userEvent.setup()
    mockUseTransactions.mockReturnValue({
      data: [
        tx({ id: 't1', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't2', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't3', description: 'SHELL OIL' })
      ],
      isLoading: false
    })
    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)

    // Unselect SHELL to keep the test deterministic on call count
    const shellCheckbox = screen.getByRole('checkbox', { name: /Include SHELL OIL in apply/i })
    await user.click(shellCheckbox)

    const applyBtn = screen.getByRole('button', { name: /^Apply$/ })
    await user.click(applyBtn)

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledTimes(2)
    })

    // Both calls write BOTH category_id AND category text
    const calls = mockUpdateMutate.mock.calls
    const ids = calls.map(c => c?.[0]?.id).sort()
    expect(ids).toEqual(['t1', 't2'])
    for (const call of calls) {
      expect(call?.[0]?.patch).toEqual({
        category_id: 'cat-food',
        category: 'Food & Dining'
      })
    }
  })

  it('shows progress text while applying and a completion summary after', async () => {
    // Make the second mutateAsync await a manual resolver so we can observe
    // the in-flight progress state. We hold the resolver on a mutable ref so
    // TS narrowing through the closure stays well-typed.
    const resolver: { fn: (() => void) | null } = { fn: null }
    let callIndex = 0
    mockUpdateMutate.mockImplementation(async () => {
      callIndex += 1
      if (callIndex === 2) {
        await new Promise<void>(resolve => {
          resolver.fn = resolve
        })
      }
    })

    const user = userEvent.setup()
    mockUseTransactions.mockReturnValue({
      data: [
        tx({ id: 't1', description: 'STARBUCKS COFFEE' }),
        tx({ id: 't2', description: 'STARBUCKS COFFEE' })
      ],
      isLoading: false
    })

    render(<AutoCategorizeDialog open onOpenChange={() => {}} />)

    const applyBtn = screen.getByRole('button', { name: /^Apply$/ })
    await user.click(applyBtn)

    // Progress text should appear (1 done out of 2 while the 2nd is in-flight)
    await waitFor(() => {
      expect(screen.getByText(/Applying \d+ of 2…/i)).toBeInTheDocument()
    })

    // Let the second mutation complete
    resolver.fn?.()

    // Completion summary
    await waitFor(() => {
      const status = screen.getByRole('status')
      expect(status.textContent).toMatch(/Categorized 2 transactions across 1 merchant\./i)
    })
  })
})
