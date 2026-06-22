import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BillMatchRuleRow } from '@/lib/data/billMatchRules'
import type { CategoryRow } from '@/lib/data/categories'

const mockUpdateMutateAsync = vi.fn()
const mockDeleteMutateAsync = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }))
const mockUseDelete = vi.fn(() => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }))

vi.mock('@/lib/data/billMatchRules', async () => ({
  useUpdateBillMatchRule: () => mockUseUpdate(),
  useDeleteBillMatchRule: () => mockUseDelete()
}))

import { RuleRow } from './RuleRow'

const HOUSEHOLD = '00000000-0000-0000-0000-000000000001'

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

function makeCategory(name: string): CategoryRow {
  return {
    id: `c-${name}`,
    household_id: HOUSEHOLD,
    name,
    type: 'expense',
    parent_category: null,
    is_fixed: null,
    exclude_from_forecast: false,
    tier: null,
    created_at: null
  }
}

beforeEach(() => {
  mockUpdateMutateAsync.mockReset()
  mockUpdateMutateAsync.mockResolvedValue(undefined)
  mockDeleteMutateAsync.mockReset()
  mockDeleteMutateAsync.mockResolvedValue(undefined)
})

describe('<RuleRow>', () => {
  it('commits an edited keyword via useUpdateBillMatchRule', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <RuleRow rule={makeRule()} categories={[makeCategory('Housing')]} />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /^mortgage$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'home loan{Enter}')

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ id: 'r1', patch: { keyword: 'home loan' } })
  })

  it('surfaces a rename error when the mutation rejects', async () => {
    mockUpdateMutateAsync.mockRejectedValueOnce(new Error('duplicate'))
    const user = userEvent.setup()
    render(
      <ul>
        <RuleRow rule={makeRule()} categories={[makeCategory('Housing')]} />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /^mortgage$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'home loan{Enter}')

    expect(await screen.findByText('duplicate')).toBeInTheDocument()
  })

  it('opens the confirm dialog and deletes on confirm', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <RuleRow rule={makeRule()} categories={[makeCategory('Housing')]} />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /delete rule mortgage/i }))
    expect(screen.getByText(/delete this match rule\?/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('r1')
  })

  it('does not call update when category is blanked on a category_map rule', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <RuleRow
          rule={makeRule({ rule_kind: 'category_map', category: 'Housing' })}
          categories={[makeCategory('Housing')]}
        />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /^Housing$/ }))
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '__unset__')
    await user.tab()

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
    expect(
      await screen.findByText(/category cannot be blank on a category_map rule/i)
    ).toBeInTheDocument()
  })

  it('does not call update when keyword is blanked', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <RuleRow rule={makeRule()} categories={[makeCategory('Housing')]} />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /^mortgage$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '   {Enter}')

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
    expect(await screen.findByText(/keyword cannot be empty/i)).toBeInTheDocument()
  })
})
