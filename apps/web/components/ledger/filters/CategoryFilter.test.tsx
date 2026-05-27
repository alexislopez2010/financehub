import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUseCategories = vi.fn<() => { data: ReadonlyArray<{ id: string; name: string; type: string }> }>()

vi.mock('@/lib/data/categories', () => ({
  useCategories: () => mockUseCategories()
}))

import { CategoryFilter } from './CategoryFilter'

beforeEach(() => {
  mockUseCategories.mockReset()
  mockUseCategories.mockReturnValue({
    data: [
      { id: 'c1', name: 'Food & Dining', type: 'expense' },
      { id: 'c2', name: 'Transportation', type: 'expense' },
      { id: 'c3', name: 'Bank Fees', type: 'expense' },
      { id: 'inc-1', name: 'Salary', type: 'income' }
    ]
  })
})

describe('<CategoryFilter>', () => {
  it('renders "Category ▼" trigger when value is undefined', () => {
    render(<CategoryFilter value={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /filter by category/i })).toBeInTheDocument()
  })

  it('renders set state with category name when value is an id', () => {
    render(<CategoryFilter value="c1" onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear category filter \(food & dining\)/i })
    expect(chip.textContent).toMatch(/Food & Dining/)
  })

  it('renders "Uncategorized" when value is null', () => {
    render(<CategoryFilter value={null} onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear category filter \(uncategorized\)/i })
    expect(chip.textContent).toMatch(/Uncategorized/)
  })

  it('clicking clear chip calls onChange(undefined)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryFilter value="c1" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /clear category filter/i }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('picking Uncategorized fires onChange(null)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by category/i }))
    const item = await screen.findByRole('menuitem', { name: 'Uncategorized' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('picking a category fires onChange with its id', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by category/i }))
    const item = await screen.findByRole('menuitem', { name: 'Food & Dining' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith('c1')
  })

  it('renders Expense and Income section labels with items alphabetical inside each', async () => {
    const user = userEvent.setup()
    render(<CategoryFilter value={undefined} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: /filter by category/i }))

    expect(await screen.findByText('Expense')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()

    const items = screen.getAllByRole('menuitem')
    expect(items[0]?.textContent).toMatch(/Uncategorized/)

    const rest = items.slice(1).map(el => el.textContent?.trim())
    expect(rest).toEqual(['Bank Fees', 'Food & Dining', 'Transportation', 'Salary'])
  })

  it('hides the Income section when no income categories are present', async () => {
    mockUseCategories.mockReturnValue({
      data: [
        { id: 'c1', name: 'Food & Dining', type: 'expense' },
        { id: 'c2', name: 'Transportation', type: 'expense' }
      ]
    })
    const user = userEvent.setup()
    render(<CategoryFilter value={undefined} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: /filter by category/i }))

    expect(await screen.findByText('Expense')).toBeInTheDocument()
    expect(screen.queryByText('Income')).toBeNull()
  })

  it('picking an income-section category fires onChange with that id', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CategoryFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by category/i }))
    const item = await screen.findByRole('menuitem', { name: 'Salary' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith('inc-1')
  })
})
