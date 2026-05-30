import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BillRow } from '@/lib/data/bills'
import type { CategoryRow } from '@/lib/data/categories'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

const mockUpdateMutate = vi.fn(async (_args: { id: string; patch: Record<string, unknown> }) => undefined)
const mockUseUpdateBill = vi.fn(() => ({ mutateAsync: mockUpdateMutate }))

const mockUseBills = vi.fn<() => {
  data: ReadonlyArray<BillRow>
  isLoading: boolean
}>()
const mockUseCategories = vi.fn<() => {
  data: ReadonlyArray<CategoryRow>
  isLoading: boolean
}>()

vi.mock('@/lib/data/bills', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/bills')>('@/lib/data/bills')
  return {
    ...actual,
    useBills: () => mockUseBills(),
    useUpdateBill: () => mockUseUpdateBill()
  }
})

vi.mock('@/lib/data/categories', async () => ({
  useCategories: () => mockUseCategories()
}))

import { BillsBudgetMappingDialog } from './BillsBudgetMappingDialog'

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b',
    household_id: HOUSEHOLD,
    name: 'Bill',
    category: null,
    budget_category_id: null,
    budget_amount: 100,
    due_day: 15,
    frequency: 'monthly',
    account: null,
    is_active: true,
    created_at: null,
    linked_debt_id: null,
    notes: null,
    ...over
  } as BillRow
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
  cat('cat-housing', 'Housing'),
  cat('cat-transport', 'Transportation'),
  cat('cat-subs', 'Entertainment & Subscriptions')
]

beforeEach(() => {
  mockUpdateMutate.mockReset()
  mockUpdateMutate.mockImplementation(async () => undefined)
  mockUseUpdateBill.mockReset()
  mockUseUpdateBill.mockReturnValue({ mutateAsync: mockUpdateMutate })
  mockUseBills.mockReset()
  mockUseCategories.mockReset()
  mockUseCategories.mockReturnValue({ data: CATEGORIES, isLoading: false })
})

describe('<BillsBudgetMappingDialog>', () => {
  it('renders one row per active bill', () => {
    mockUseBills.mockReturnValue({
      data: [
        bill({ id: 'b1', name: 'Mortgage', category: 'Mortgage/Rent' }),
        bill({ id: 'b2', name: 'Netflix', category: 'Subscriptions' }),
        // Inactive should be excluded
        bill({ id: 'b3', name: 'Old Bill', category: null, is_active: false }),
      ],
      isLoading: false
    })

    render(<BillsBudgetMappingDialog open onOpenChange={() => {}} />)

    expect(screen.getByText('Map bills → budget categories')).toBeInTheDocument()
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.queryByText('Old Bill')).not.toBeInTheDocument()
  })

  it('pre-selects suggestions from suggestBudgetCategoryId for unmapped bills', () => {
    mockUseBills.mockReturnValue({
      data: [
        bill({ id: 'b1', name: 'Rent', category: 'Mortgage/Rent' }),
        bill({ id: 'b2', name: 'Netflix', category: 'Subscriptions' }),
        bill({ id: 'b3', name: 'Strange Bill', category: 'Foo/Bar' }),
      ],
      isLoading: false
    })

    render(<BillsBudgetMappingDialog open onOpenChange={() => {}} />)

    const rentSelect = screen.getByRole('combobox', { name: /Budget category for Rent/i }) as HTMLSelectElement
    expect(rentSelect.value).toBe('cat-housing')

    const netflixSelect = screen.getByRole('combobox', { name: /Budget category for Netflix/i }) as HTMLSelectElement
    expect(netflixSelect.value).toBe('cat-subs')

    // Strange Bill → no pattern match → "(none)"
    const strangeSelect = screen.getByRole('combobox', { name: /Budget category for Strange Bill/i }) as HTMLSelectElement
    expect(strangeSelect.value).toBe('')
  })

  it('Save button label reflects the count of changed rows', async () => {
    const user = userEvent.setup()
    mockUseBills.mockReturnValue({
      data: [
        // Already mapped to housing — suggestion is the same → no change.
        bill({ id: 'b1', name: 'Rent', category: 'Mortgage/Rent', budget_category_id: 'cat-housing' }),
        // Unmapped → suggestion seeds it → counts as a change vs baseline (null).
        bill({ id: 'b2', name: 'Netflix', category: 'Subscriptions' }),
      ],
      isLoading: false
    })

    render(<BillsBudgetMappingDialog open onOpenChange={() => {}} />)

    // Netflix seeded with 'cat-subs' but baseline was null → 1 pending change.
    expect(screen.getByRole('button', { name: /Save 1 change/i })).toBeInTheDocument()

    // Override Rent to Transportation → 2 changes pending.
    const rentSelect = screen.getByRole('combobox', { name: /Budget category for Rent/i })
    await user.selectOptions(rentSelect, 'cat-transport')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save 2 changes/i })).toBeInTheDocument()
    })
  })

  it('calls useUpdateBill.mutateAsync once per changed row on Save', async () => {
    const user = userEvent.setup()
    mockUseBills.mockReturnValue({
      data: [
        bill({ id: 'b1', name: 'Rent', category: 'Mortgage/Rent' }),
        bill({ id: 'b2', name: 'Netflix', category: 'Subscriptions' }),
      ],
      isLoading: false
    })

    render(<BillsBudgetMappingDialog open onOpenChange={() => {}} />)

    const saveBtn = screen.getByRole('button', { name: /Save 2 changes/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledTimes(2)
    })

    const calls = mockUpdateMutate.mock.calls
    const ids = calls.map(c => c?.[0]?.id).sort()
    expect(ids).toEqual(['b1', 'b2'])

    const patches = calls.map(c => c?.[0]?.patch)
    expect(patches).toContainEqual({ budget_category_id: 'cat-housing' })
    expect(patches).toContainEqual({ budget_category_id: 'cat-subs' })
  })

  it('skips unchanged rows when Save is clicked', async () => {
    const user = userEvent.setup()
    mockUseBills.mockReturnValue({
      data: [
        // Already mapped — suggestion would also be housing — baseline === draft → not sent.
        bill({ id: 'b1', name: 'Rent', category: 'Mortgage/Rent', budget_category_id: 'cat-housing' }),
        // Unmapped → suggestion seeds cat-subs → counts as a change.
        bill({ id: 'b2', name: 'Netflix', category: 'Subscriptions' }),
      ],
      isLoading: false
    })

    render(<BillsBudgetMappingDialog open onOpenChange={() => {}} />)

    const saveBtn = screen.getByRole('button', { name: /Save 1 change/i })
    await user.click(saveBtn)

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledTimes(1)
    })
    expect(mockUpdateMutate.mock.calls[0]?.[0]?.id).toBe('b2')
  })

  it('Cancel does not invoke the mutation', async () => {
    const user = userEvent.setup()
    mockUseBills.mockReturnValue({
      data: [bill({ id: 'b1', name: 'Rent', category: 'Mortgage/Rent' })],
      isLoading: false
    })

    const onOpenChange = vi.fn()
    render(<BillsBudgetMappingDialog open onOpenChange={onOpenChange} />)

    const cancelBtn = screen.getByRole('button', { name: /^Cancel$/ })
    await user.click(cancelBtn)

    expect(mockUpdateMutate).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
