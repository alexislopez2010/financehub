import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BillRow } from '@/lib/data/bills'
import type { CategoryRow } from '@/lib/data/categories'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

const mockUpdateMutate = vi.fn()
const mockUseUpdateBill = vi.fn(() => ({ mutate: mockUpdateMutate, isPending: false }))

const mockUseTransactions = vi.fn(() => ({ data: [], isLoading: false }))
const mockUseBillMatchRules = vi.fn(() => ({ data: [], isLoading: false }))
const mockUseCategories = vi.fn<() => { data: ReadonlyArray<CategoryRow>; isLoading: boolean }>()

vi.mock('@/lib/data/bills', async () => {
  const actual = await vi.importActual<typeof import('@/lib/data/bills')>('@/lib/data/bills')
  return {
    ...actual,
    useUpdateBill: () => mockUseUpdateBill()
  }
})

vi.mock('@/lib/data/transactions', () => ({
  useTransactions: () => mockUseTransactions()
}))

vi.mock('@/lib/data/billMatchRules', () => ({
  useBillMatchRules: () => mockUseBillMatchRules()
}))

vi.mock('@/lib/data/categories', () => ({
  useCategories: () => mockUseCategories()
}))

// BillExpanded now renders BillDetailsEditor which pulls accounts too.
vi.mock('@/lib/data/accounts', () => ({
  useAccounts: () => ({ data: [], isLoading: false })
}))

import { BillExpanded } from './BillExpanded'

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    household_id: HOUSEHOLD,
    name: 'Rent',
    category: 'Mortgage/Rent',
    budget_category_id: null,
    budget_amount: 2000,
    due_day: 1,
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
]

beforeEach(() => {
  mockUpdateMutate.mockReset()
  mockUseUpdateBill.mockReset()
  mockUseUpdateBill.mockReturnValue({ mutate: mockUpdateMutate, isPending: false })
  mockUseCategories.mockReset()
  mockUseCategories.mockReturnValue({ data: CATEGORIES, isLoading: false })
})

const TODAY = { year: 2025, month: 5, day: 15 }

describe('<BillExpanded> budget category picker', () => {
  it('shows the budget category dropdown with the current value pre-selected', () => {
    render(<BillExpanded bill={bill({ budget_category_id: 'cat-housing' })} today={TODAY} />)

    const select = screen.getByRole('combobox', { name: /Budget category for Rent/i }) as HTMLSelectElement
    expect(select.value).toBe('cat-housing')
    // Unmapped helper text should NOT show when mapped.
    expect(screen.queryByText(/Unmapped/)).not.toBeInTheDocument()
  })

  it('shows the unmapped hint and calls useUpdateBill.mutate on change', async () => {
    const user = userEvent.setup()
    render(<BillExpanded bill={bill({ budget_category_id: null })} today={TODAY} />)

    expect(screen.getByText(/Unmapped/)).toBeInTheDocument()

    const select = screen.getByRole('combobox', { name: /Budget category for Rent/i })
    await user.selectOptions(select, 'cat-transport')

    expect(mockUpdateMutate).toHaveBeenCalledTimes(1)
    expect(mockUpdateMutate.mock.calls[0]?.[0]).toEqual({
      id: 'b1',
      patch: { budget_category_id: 'cat-transport' }
    })
  })
})
