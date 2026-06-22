import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CategoryRow } from '@/lib/data/categories'

const mockUseCategories = vi.fn()
const mockUseCreate = vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }))
const mockUseUpdate = vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }))
const mockUseDelete = vi.fn(() => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }))

vi.mock('@/lib/data/categories', async () => ({
  useCategories: () => mockUseCategories(),
  useCreateCategory: () => mockUseCreate(),
  useUpdateCategory: () => mockUseUpdate(),
  useDeleteCategory: () => mockUseDelete()
}))

import { CategoriesSection } from './CategoriesSection'

function makeCategory(over: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'c1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Groceries',
    type: 'expense',
    parent_category: null,
    is_fixed: null,
    tier: null,
    created_at: '2025-01-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  mockUseCategories.mockReset()
})

describe('<CategoriesSection>', () => {
  it('shows a loading state', () => {
    mockUseCategories.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<CategoriesSection />)
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
  })

  it('renders the empty state when no categories exist', () => {
    mockUseCategories.mockReturnValue({ data: [], isLoading: false, error: null })
    render(<CategoriesSection />)
    expect(screen.getByText(/no categories yet/i)).toBeInTheDocument()
  })

  it('renders error state on failure', () => {
    mockUseCategories.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') })
    render(<CategoriesSection />)
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load categories.*boom/i)
  })

  it('renders categories grouped by type and parent', () => {
    mockUseCategories.mockReturnValue({
      data: [
        makeCategory({ id: 'c1', name: 'Salary', type: 'income', parent_category: null }),
        makeCategory({ id: 'c2', name: 'Groceries', type: 'expense', parent_category: 'Food' }),
        makeCategory({ id: 'c3', name: 'Restaurants', type: 'expense', parent_category: 'Food' }),
        makeCategory({ id: 'c4', name: 'Rent', type: 'expense', parent_category: null })
      ],
      isLoading: false,
      error: null
    })
    render(<CategoriesSection />)

    // "Income" and "Expense" both appear as group labels AND as <option> elements
    // in the AddCategoryForm select, so just assert at least one of each is rendered.
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Expense').length).toBeGreaterThan(0)
    expect(screen.getByText('Food')).toBeInTheDocument()
    // (General) appears in both Income and Expense; assert at least one shows.
    expect(screen.getAllByText('(General)').length).toBeGreaterThan(0)
    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Restaurants')).toBeInTheDocument()
    expect(screen.getByText('Rent')).toBeInTheDocument()
    expect(screen.getByText('4 categories')).toBeInTheDocument()
  })
})
