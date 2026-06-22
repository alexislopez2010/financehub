import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CategoryRow as CategoryRowType } from '@/lib/data/categories'

const mockUpdateMutateAsync = vi.fn()
const mockDeleteMutateAsync = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: mockUpdateMutateAsync, isPending: false }))
const mockUseDelete = vi.fn(() => ({ mutateAsync: mockDeleteMutateAsync, isPending: false }))

vi.mock('@/lib/data/categories', async () => ({
  useUpdateCategory: () => mockUseUpdate(),
  useDeleteCategory: () => mockUseDelete()
}))

import { CategoryRow } from './CategoryRow'

function makeCategory(over: Partial<CategoryRowType> = {}): CategoryRowType {
  return {
    id: 'c1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Groceries',
    type: 'expense',
    parent_category: null,
    is_fixed: null,
    exclude_from_forecast: false,
    tier: null,
    created_at: '2025-01-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  mockUpdateMutateAsync.mockReset()
  mockUpdateMutateAsync.mockResolvedValue(undefined)
  mockDeleteMutateAsync.mockReset()
  mockDeleteMutateAsync.mockResolvedValue(undefined)
})

describe('<CategoryRow>', () => {
  it('commits an edited name via useUpdateCategory', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <CategoryRow category={makeCategory()} />
      </ul>
    )

    // Click the name (EditableCell) to enter edit mode.
    await user.click(screen.getByRole('button', { name: /^Groceries$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Food{Enter}')

    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({ id: 'c1', patch: { name: 'Food' } })
  })

  it('does not commit empty or whitespace names', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <CategoryRow category={makeCategory()} />
      </ul>
    )
    await user.click(screen.getByRole('button', { name: /^Groceries$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '   {Enter}')
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled()
  })

  it('surfaces a rename error when the mutation rejects', async () => {
    mockUpdateMutateAsync.mockRejectedValueOnce(new Error('duplicate'))
    const user = userEvent.setup()
    render(
      <ul>
        <CategoryRow category={makeCategory()} />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /^Groceries$/ }))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'Food{Enter}')

    expect(await screen.findByText('duplicate')).toBeInTheDocument()
  })

  it('opens the confirm dialog, mentions Uncategorized, and deletes on confirm', async () => {
    const user = userEvent.setup()
    render(
      <ul>
        <CategoryRow category={makeCategory()} />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /delete groceries/i }))
    expect(screen.getByText(/transactions in this category will become uncategorized/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mockDeleteMutateAsync).toHaveBeenCalledWith('c1')
  })
})
