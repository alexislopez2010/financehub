import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockMutateAsync = vi.fn()
const mockUseCreate = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))

vi.mock('@/lib/data/categories', async () => ({
  useCreateCategory: () => mockUseCreate()
}))

import { AddCategoryForm } from './AddCategoryForm'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockMutateAsync.mockResolvedValue({ id: 'new', name: 'X' })
})

describe('<AddCategoryForm>', () => {
  it('disables the submit button when the name field is blank', () => {
    render(<AddCategoryForm />)
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })

  it('keeps submit disabled when the name field has only whitespace', async () => {
    const user = userEvent.setup()
    render(<AddCategoryForm />)
    await user.type(screen.getByLabelText(/category name/i), '   ')
    expect(screen.getByRole('button', { name: /add/i })).toBeDisabled()
  })

  it('submits with correct args, trims input, and clears fields on success', async () => {
    const user = userEvent.setup()
    render(<AddCategoryForm />)

    await user.selectOptions(screen.getByLabelText(/category type/i), 'income')
    await user.type(screen.getByLabelText(/parent category/i), '  Salary ')
    await user.type(screen.getByLabelText(/category name/i), '  Bonus  ')

    await user.click(screen.getByRole('button', { name: /add/i }))

    expect(mockMutateAsync).toHaveBeenCalledWith({
      household_id: LOPEZ_HOUSEHOLD_ID,
      type: 'income',
      name: 'Bonus',
      parent_category: 'Salary'
    })

    // After success, the name + parent fields clear.
    expect(screen.getByLabelText(/category name/i)).toHaveValue('')
    expect(screen.getByLabelText(/parent category/i)).toHaveValue('')
  })

  it('passes null parent_category when the parent field is empty', async () => {
    const user = userEvent.setup()
    render(<AddCategoryForm />)
    await user.type(screen.getByLabelText(/category name/i), 'Groceries')
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(mockMutateAsync).toHaveBeenCalledWith({
      household_id: LOPEZ_HOUSEHOLD_ID,
      type: 'expense',
      name: 'Groceries',
      parent_category: null
    })
  })
})
