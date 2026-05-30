import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BudgetRow as BudgetTableRow } from '@/lib/data/budgets'
import type { TransactionRow } from '@/lib/data/transactions'
import type { CategoryRow } from '@/lib/data/categories'
import type { BillRow } from '@/lib/data/bills'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

const mockUseBudgets = vi.fn<() => {
  data: ReadonlyArray<BudgetTableRow>
  isLoading: boolean
  error: Error | null
}>()
const mockUseTransactions = vi.fn<() => {
  data: ReadonlyArray<TransactionRow>
  isLoading: boolean
  error: Error | null
}>()
const mockUseCategories = vi.fn<() => {
  data: ReadonlyArray<CategoryRow>
  isLoading: boolean
  error: Error | null
}>()
const mockUseBills = vi.fn<() => {
  data: ReadonlyArray<BillRow>
  isLoading: boolean
  error: Error | null
}>()

const mockMutate = vi.fn()
const mutationHandle = { mutate: mockMutate, isPending: false }

vi.mock('@/lib/data/budgets', () => ({
  useBudgets: () => mockUseBudgets(),
  useCreateBudget: () => mutationHandle,
  useUpdateBudget: () => mutationHandle,
  useDeleteBudget: () => mutationHandle
}))

vi.mock('@/lib/data/transactions', () => ({
  useTransactions: () => mockUseTransactions()
}))

vi.mock('@/lib/data/categories', () => ({
  useCategories: () => mockUseCategories()
}))

vi.mock('@/lib/data/bills', () => ({
  useBills: () => mockUseBills()
}))

import { BudgetSection } from './BudgetSection'

function budget(over: Partial<BudgetTableRow> = {}): BudgetTableRow {
  return {
    id: 'b1',
    household_id: HOUSEHOLD,
    year: 2025,
    month: 5,
    category: 'Groceries',
    category_id: null,
    amount: 1000,
    created_at: null,
    ...over
  } as BudgetTableRow
}

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: HOUSEHOLD,
    date: '2025-05-15',
    description: 'Grocery shopping',
    amount: -100,
    type: 'Expense',
    category: 'Groceries',
    category_id: null,
    account: null,
    account_id: null,
    created_at: null,
    fingerprint: null,
    imported_at: null,
    member: null,
    notes: null,
    transfer_pair_id: null,
    updated_at: null,
    ...over
  } as unknown as TransactionRow
}

beforeEach(() => {
  mockUseCategories.mockReturnValue({ data: [], isLoading: false, error: null })
  mockUseBills.mockReturnValue({ data: [], isLoading: false, error: null })
  mockMutate.mockClear()
})

const period = { year: 2025, month: 5 }

describe('<BudgetSection> over-budget reconciliation sub-line', () => {
  it('renders positive sub-line (emerald) when income variance fully covers overage', () => {
    // Budget $9,614, actual $21,933 → overBudget $12,319
    // Planned income $0, actual income $21,999 → variance $21,999 (>= overage)
    // Net unplanned: $21,999 - $12,319 = $9,680
    mockUseBudgets.mockReturnValue({
      data: [budget({ amount: 9614 })],
      isLoading: false,
      error: null
    })
    mockUseTransactions.mockReturnValue({
      data: [tx({ amount: -21933 })],
      isLoading: false,
      error: null
    })

    render(
      <BudgetSection period={period} plannedIncome={0} actualIncome={21999} />
    )

    const subLine = screen.getByTestId('over-budget-reconciliation')
    expect(subLine).toHaveClass('text-emerald-700')
    expect(subLine.textContent).toContain('funded by +$21,999 unplanned income')
    expect(subLine.textContent).toContain('net unplanned: +$9,680 saved')
    // Existing "over by" line still renders
    expect(screen.getByText(/over by \$12,319/)).toBeInTheDocument()
  })

  it('renders warning sub-line (amber) when income variance partially covers overage', () => {
    // Budget $1,000, actual $2,000 → overBudget $1,000
    // Planned $5,000, actual $5,400 → variance $400 (< overage)
    // Unfunded: $600
    mockUseBudgets.mockReturnValue({
      data: [budget({ amount: 1000 })],
      isLoading: false,
      error: null
    })
    mockUseTransactions.mockReturnValue({
      data: [tx({ amount: -2000 })],
      isLoading: false,
      error: null
    })

    render(
      <BudgetSection period={period} plannedIncome={5000} actualIncome={5400} />
    )

    const subLine = screen.getByTestId('over-budget-reconciliation')
    expect(subLine).toHaveClass('text-amber-600')
    expect(subLine.textContent).toContain('+$400 unplanned income partially covers')
    expect(subLine.textContent).toContain('$600 unfunded overspend')
  })

  it('renders negative sub-line (red) when income variance is <= 0', () => {
    // Budget $1,000, actual $1,750 → overBudget $750
    // Planned $5,000, actual $3,500 → variance -$1,500 (no unplanned income)
    mockUseBudgets.mockReturnValue({
      data: [budget({ amount: 1000 })],
      isLoading: false,
      error: null
    })
    mockUseTransactions.mockReturnValue({
      data: [tx({ amount: -1750 })],
      isLoading: false,
      error: null
    })

    render(
      <BudgetSection period={period} plannedIncome={5000} actualIncome={3500} />
    )

    const subLine = screen.getByTestId('over-budget-reconciliation')
    expect(subLine).toHaveClass('text-red-700')
    expect(subLine.textContent).toContain('no unplanned income to cover')
    expect(subLine.textContent).toContain('$750 truly over plan')
  })

  it('does not render sub-line when actual spend is under budget', () => {
    // Budget $1,000, actual $500 → not over budget
    mockUseBudgets.mockReturnValue({
      data: [budget({ amount: 1000 })],
      isLoading: false,
      error: null
    })
    mockUseTransactions.mockReturnValue({
      data: [tx({ amount: -500 })],
      isLoading: false,
      error: null
    })

    render(
      <BudgetSection period={period} plannedIncome={5000} actualIncome={8000} />
    )

    expect(screen.queryByTestId('over-budget-reconciliation')).not.toBeInTheDocument()
    // "over by" line is also absent; instead "left" is shown
    expect(screen.getByText(/\$500 left/)).toBeInTheDocument()
  })

  it('does not render sub-line when income props are omitted', () => {
    mockUseBudgets.mockReturnValue({
      data: [budget({ amount: 1000 })],
      isLoading: false,
      error: null
    })
    mockUseTransactions.mockReturnValue({
      data: [tx({ amount: -2000 })],
      isLoading: false,
      error: null
    })

    render(<BudgetSection period={period} />)

    // Over budget but no income props → sub-line suppressed (but "over by" still shows)
    expect(screen.queryByTestId('over-budget-reconciliation')).not.toBeInTheDocument()
    expect(screen.getByText(/over by \$1,000/)).toBeInTheDocument()
  })
})
