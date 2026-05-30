import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BillRow } from '@/lib/data/bills'
import type { CategoryRow } from '@/lib/data/categories'

const mockMutateAsync = vi.fn()
const mockUseCreate = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))
const mockUseCategories = vi.fn()

vi.mock('@/lib/data/billMatchRules', async () => ({
  useCreateBillMatchRule: () => mockUseCreate()
}))

vi.mock('@/lib/data/categories', async () => ({
  useCategories: () => mockUseCategories()
}))

import { AddRuleForm } from './AddRuleForm'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'

const HOUSEHOLD = LOPEZ_HOUSEHOLD_ID

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
    frequency: 'monthly',
    is_active: true,
    linked_debt_id: null,
    notes: null,
    ...over
  }
}

function makeCategory(name: string): CategoryRow {
  return {
    id: `c-${name}`,
    household_id: HOUSEHOLD,
    name,
    type: 'expense',
    parent_category: null,
    is_fixed: null,
    created_at: null
  }
}

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockMutateAsync.mockResolvedValue({ id: 'new' })
  mockUseCategories.mockReset()
  mockUseCategories.mockReturnValue({
    data: [makeCategory('Housing'), makeCategory('Transportation')],
    isLoading: false,
    error: null
  })
})

describe('<AddRuleForm>', () => {
  it('disables the submit button when the keyword field is blank', () => {
    render(<AddRuleForm bill={makeBill()} />)
    expect(screen.getByRole('button', { name: /add rule/i })).toBeDisabled()
  })

  it('keeps submit disabled when keyword is only whitespace', async () => {
    const user = userEvent.setup()
    render(<AddRuleForm bill={makeBill()} />)
    await user.type(screen.getByLabelText(/rule keyword/i), '   ')
    await user.selectOptions(screen.getByLabelText(/rule category/i), 'Housing')
    expect(screen.getByRole('button', { name: /add rule/i })).toBeDisabled()
  })

  it('keeps submit disabled when category is not chosen', async () => {
    const user = userEvent.setup()
    render(<AddRuleForm bill={makeBill()} />)
    await user.type(screen.getByLabelText(/rule keyword/i), 'mortgage')
    expect(screen.getByRole('button', { name: /add rule/i })).toBeDisabled()
  })

  it('submits with the bill id, trims input, and clears fields on success', async () => {
    const user = userEvent.setup()
    render(<AddRuleForm bill={makeBill()} />)

    await user.type(screen.getByLabelText(/rule keyword/i), '  mortgage  ')
    await user.selectOptions(screen.getByLabelText(/rule category/i), 'Housing')
    await user.type(screen.getByLabelText(/rule account filter/i), '  Chase  ')

    await user.click(screen.getByRole('button', { name: /add rule/i }))

    expect(mockMutateAsync).toHaveBeenCalledWith({
      household_id: HOUSEHOLD,
      bill_id: 'b1',
      bill_name: 'Mortgage',
      keyword: 'mortgage',
      category: 'Housing',
      account_filter: 'Chase',
      sub_category: null,
      rule_kind: 'name_keyword'
    })

    expect(screen.getByLabelText(/rule keyword/i)).toHaveValue('')
    expect(screen.getByLabelText(/rule account filter/i)).toHaveValue('')
  })

  it('passes null bill_id and bill_name when bill prop is null (General rules)', async () => {
    const user = userEvent.setup()
    render(<AddRuleForm bill={null} />)

    await user.type(screen.getByLabelText(/rule keyword/i), 'amazon')
    await user.selectOptions(screen.getByLabelText(/rule category/i), 'Housing')
    await user.click(screen.getByRole('button', { name: /add rule/i }))

    expect(mockMutateAsync).toHaveBeenCalledWith({
      household_id: HOUSEHOLD,
      bill_id: null,
      bill_name: null,
      keyword: 'amazon',
      category: 'Housing',
      account_filter: null,
      sub_category: null,
      rule_kind: 'name_keyword'
    })
  })

  it('passes null account_filter when the account field is empty', async () => {
    const user = userEvent.setup()
    render(<AddRuleForm bill={makeBill()} />)
    await user.type(screen.getByLabelText(/rule keyword/i), 'mortgage')
    await user.selectOptions(screen.getByLabelText(/rule category/i), 'Housing')
    await user.click(screen.getByRole('button', { name: /add rule/i }))
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ account_filter: null }))
  })
})
