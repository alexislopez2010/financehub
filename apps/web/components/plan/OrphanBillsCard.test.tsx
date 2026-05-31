import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BudgetRow as BudgetTableRow } from '@/lib/data/budgets'
import type { CategoryRow } from '@/lib/data/categories'
import type { BillRow } from '@/lib/data/bills'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

const mockUseBudgets = vi.fn<() => { data: ReadonlyArray<BudgetTableRow> }>()
const mockUseBills = vi.fn<() => { data: ReadonlyArray<BillRow> }>()
const mockUseCategories = vi.fn<() => { data: ReadonlyArray<CategoryRow> }>()

const mockCreateBudget = vi.fn()
const mockUpdateBill = vi.fn()

vi.mock('@/lib/data/budgets', () => ({
  useBudgets: () => mockUseBudgets(),
  useCreateBudget: () => ({ mutate: mockCreateBudget, isPending: false })
}))

vi.mock('@/lib/data/bills', () => ({
  useBills: () => mockUseBills(),
  useUpdateBill: () => ({ mutate: mockUpdateBill, isPending: false })
}))

vi.mock('@/lib/data/categories', () => ({
  useCategories: () => mockUseCategories()
}))

import { OrphanBillsCard } from './OrphanBillsCard'

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'bill-1',
    household_id: HOUSEHOLD,
    name: 'Electric',
    category: null,
    budget_category_id: 'cat-elec',
    budget_amount: 120,
    due_day: 5,
    frequency: 'monthly',
    account: null,
    is_active: true,
    created_at: null,
    linked_debt_id: null,
    notes: null,
    ...over
  } as BillRow
}

function budget(over: Partial<BudgetTableRow> = {}): BudgetTableRow {
  return {
    id: 'b1',
    household_id: HOUSEHOLD,
    year: 2026,
    month: 6,
    category: 'Electricity',
    category_id: 'cat-elec',
    amount: 100,
    sub_category: null,
    created_at: null,
    ...over
  } as BudgetTableRow
}

function cat(id: string, name: string, type: 'expense' | 'income' = 'expense'): CategoryRow {
  return {
    id,
    household_id: HOUSEHOLD,
    name,
    type,
    parent_category: null,
    is_fixed: null,
    created_at: null
  } as CategoryRow
}

const period = { year: 2026, month: 6 }

const CATEGORIES = [
  cat('cat-elec', 'Electricity'),
  cat('cat-water', 'Water'),
  cat('cat-tax', 'Taxes')
]

beforeEach(() => {
  mockCreateBudget.mockReset()
  mockUpdateBill.mockReset()
  mockUseCategories.mockReset()
  mockUseCategories.mockReturnValue({ data: CATEGORIES })
  mockUseBudgets.mockReset()
  mockUseBills.mockReset()
})

describe('<OrphanBillsCard>', () => {
  it('renders nothing when there are no orphan bills', () => {
    mockUseBills.mockReturnValue({ data: [] })
    mockUseBudgets.mockReturnValue({ data: [] })

    const { container } = render(<OrphanBillsCard period={period} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when every mapped bill has a budget row for this period', () => {
    mockUseBills.mockReturnValue({
      data: [bill({ id: 'b1', budget_category_id: 'cat-elec' })]
    })
    mockUseBudgets.mockReturnValue({
      data: [budget({ category_id: 'cat-elec' })]
    })

    const { container } = render(<OrphanBillsCard period={period} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one row per orphan bill with name, amount, and category', () => {
    mockUseBills.mockReturnValue({
      data: [
        bill({ id: 'b1', name: 'Electric', budget_category_id: 'cat-elec', budget_amount: 120 }),
        bill({ id: 'b2', name: 'Water', budget_category_id: 'cat-water', budget_amount: 60 }),
        bill({ id: 'b3', name: 'Property Tax', budget_category_id: 'cat-tax', budget_amount: 800 })
      ]
    })
    mockUseBudgets.mockReturnValue({ data: [] })

    render(<OrphanBillsCard period={period} />)

    expect(screen.getByText('Bills not yet in your budget')).toBeInTheDocument()

    // Header sub-text reports count + total ($120 + $60 + $800 = $980).
    expect(screen.getByText(/3 bills mapped to categories without a budget row for June 2026/)).toBeInTheDocument()
    expect(screen.getByText(/\$980\/mo total/)).toBeInTheDocument()

    expect(screen.getByText('Electric')).toBeInTheDocument()
    expect(screen.getByText('Water')).toBeInTheDocument()
    expect(screen.getByText('Property Tax')).toBeInTheDocument()

    // Sorted desc by amount: Property Tax first.
    const rowNames = screen.getAllByRole('listitem').map(li => li.querySelector('.text-ink')?.textContent)
    expect(rowNames).toEqual(['Property Tax', 'Electric', 'Water'])
  })

  it('clicking "Add to plan" calls useCreateBudget with the right args', async () => {
    const user = userEvent.setup()
    mockUseBills.mockReturnValue({
      data: [bill({ id: 'b1', name: 'Electric', budget_category_id: 'cat-elec', budget_amount: 120 })]
    })
    mockUseBudgets.mockReturnValue({ data: [] })

    render(<OrphanBillsCard period={period} />)

    await user.click(screen.getByRole('button', { name: /Add to plan/i }))

    expect(mockCreateBudget).toHaveBeenCalledTimes(1)
    expect(mockCreateBudget).toHaveBeenCalledWith({
      household_id: HOUSEHOLD,
      year: 2026,
      month: 6,
      category: 'Electricity',
      category_id: 'cat-elec',
      amount: 120
    })
  })

  it('clicking "Remap" opens an inline category picker', async () => {
    const user = userEvent.setup()
    mockUseBills.mockReturnValue({
      data: [bill({ id: 'b1', name: 'Electric', budget_category_id: 'cat-elec' })]
    })
    mockUseBudgets.mockReturnValue({ data: [] })

    render(<OrphanBillsCard period={period} />)

    expect(screen.queryByLabelText(/Remap Electric to a different category/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Remap Electric$/i }))

    const picker = await screen.findByLabelText(/Remap Electric to a different category/i)
    expect(picker).toBeInTheDocument()

    // Choosing a new category calls useUpdateBill.
    await user.selectOptions(picker, 'cat-water')
    expect(mockUpdateBill).toHaveBeenCalledWith({
      id: 'b1',
      patch: { budget_category_id: 'cat-water' }
    })
  })
})
