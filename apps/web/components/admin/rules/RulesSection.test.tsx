import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BillMatchRuleRow } from '@/lib/data/billMatchRules'
import type { BillRow } from '@/lib/data/bills'
import type { CategoryRow } from '@/lib/data/categories'

const mockUseRules = vi.fn()
const mockUseBills = vi.fn()
const mockUseCategories = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseDelete = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseCreate = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))

vi.mock('@/lib/data/billMatchRules', async () => ({
  useBillMatchRules: () => mockUseRules(),
  useUpdateBillMatchRule: () => mockUseUpdate(),
  useDeleteBillMatchRule: () => mockUseDelete(),
  useCreateBillMatchRule: () => mockUseCreate()
}))

vi.mock('@/lib/data/bills', async () => ({
  useBills: () => mockUseBills()
}))

vi.mock('@/lib/data/categories', async () => ({
  useCategories: () => mockUseCategories()
}))

import { RulesSection } from './RulesSection'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

function makeBill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    household_id: HOUSEHOLD,
    name: 'Mortgage',
    budget_amount: 2000,
    budget_category_id: null,
    account: null,
    category: null,
    created_at: null,
    due_day: 1,
    due_month_anchor: null,
    frequency: 'monthly',
    is_active: true,
    linked_debt_id: null,
    notes: null,
    ...over
  }
}

function makeRule(over: Partial<BillMatchRuleRow> = {}): BillMatchRuleRow {
  return {
    id: 'r1',
    household_id: HOUSEHOLD,
    bill_id: 'b1',
    bill_name: null,
    category: 'Housing',
    sub_category: null,
    keyword: 'mortgage',
    account_filter: null,
    rule_kind: 'name_keyword',
    tx_type_override: null,
    pair_account_filter: null,
    created_at: null,
    ...over
  }
}

function makeCategory(over: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'c1',
    household_id: HOUSEHOLD,
    name: 'Housing',
    type: 'expense',
    parent_category: null,
    is_fixed: null,
    created_at: null,
    ...over
  }
}

beforeEach(() => {
  mockUseRules.mockReset()
  mockUseBills.mockReset()
  mockUseCategories.mockReset()
})

describe('<RulesSection>', () => {
  it('shows a loading state while any of the three queries is loading', () => {
    mockUseRules.mockReturnValue({ data: undefined, isLoading: true, error: null })
    mockUseBills.mockReturnValue({ data: undefined, isLoading: false, error: null })
    mockUseCategories.mockReturnValue({ data: undefined, isLoading: false, error: null })
    render(<RulesSection />)
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
  })

  it('surfaces an error from any of the three queries', () => {
    mockUseRules.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') })
    mockUseBills.mockReturnValue({ data: [], isLoading: false, error: null })
    mockUseCategories.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<RulesSection />)
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load match rules.*boom/i)
  })

  it('renders rules grouped by bill with frequency in the header', () => {
    const bills = [makeBill({ id: 'b1', name: 'Mortgage', frequency: 'monthly' })]
    const rules = [makeRule({ id: 'r1', bill_id: 'b1', keyword: 'mortgage', category: 'Housing' })]
    mockUseRules.mockReturnValue({ data: rules, isLoading: false, error: null })
    mockUseBills.mockReturnValue({ data: bills, isLoading: false, error: null })
    mockUseCategories.mockReturnValue({ data: [makeCategory()], isLoading: false, error: null })

    render(<RulesSection />)
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
    expect(screen.getByText(/monthly/i)).toBeInTheDocument()
    expect(screen.getByText('mortgage')).toBeInTheDocument()
    expect(screen.getByText('1 rule')).toBeInTheDocument()
  })

  it('renders the General rules group at the bottom for null-bill rules', () => {
    const bills = [makeBill({ id: 'b1', name: 'Mortgage' })]
    const rules = [
      makeRule({ id: 'g1', bill_id: null, bill_name: null, keyword: 'generic', category: 'Housing' })
    ]
    mockUseRules.mockReturnValue({ data: rules, isLoading: false, error: null })
    mockUseBills.mockReturnValue({ data: bills, isLoading: false, error: null })
    mockUseCategories.mockReturnValue({ data: [makeCategory()], isLoading: false, error: null })

    render(<RulesSection />)
    expect(screen.getByText(/general rules/i)).toBeInTheDocument()
    expect(screen.getByText('generic')).toBeInTheDocument()
  })

  it('shows the "No rules" placeholder when a bill has none', () => {
    const bills = [makeBill({ id: 'b1', name: 'Mortgage' })]
    mockUseRules.mockReturnValue({ data: [], isLoading: false, error: null })
    mockUseBills.mockReturnValue({ data: bills, isLoading: false, error: null })
    mockUseCategories.mockReturnValue({ data: [makeCategory()], isLoading: false, error: null })

    render(<RulesSection />)
    expect(screen.getByText(/no rules.*detected manually/i)).toBeInTheDocument()
  })

  it('hides inactive bills from the grouping', () => {
    const bills = [
      makeBill({ id: 'b1', name: 'Mortgage', is_active: true }),
      makeBill({ id: 'b2', name: 'Old Service', is_active: false })
    ]
    mockUseRules.mockReturnValue({ data: [], isLoading: false, error: null })
    mockUseBills.mockReturnValue({ data: bills, isLoading: false, error: null })
    mockUseCategories.mockReturnValue({ data: [makeCategory()], isLoading: false, error: null })

    render(<RulesSection />)
    expect(screen.getByText('Mortgage')).toBeInTheDocument()
    expect(screen.queryByText('Old Service')).not.toBeInTheDocument()
  })
})
