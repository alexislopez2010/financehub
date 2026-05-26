import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const membersMock = vi.fn<() => { data: ReadonlyArray<{ display_name: string }> }>()
const accountsMock = vi.fn<() => { data: ReadonlyArray<{ id: string; name: string }> }>()
const categoriesMock = vi.fn<() => { data: ReadonlyArray<{ id: string; name: string }> }>()

vi.mock('@/lib/data/householdMembers', () => ({
  useHouseholdMembersList: () => membersMock()
}))
vi.mock('@/lib/data/accounts', () => ({
  useAccounts: () => accountsMock()
}))
vi.mock('@/lib/data/categories', () => ({
  useCategories: () => categoriesMock()
}))

import { FilterChips } from './FilterChips'

beforeEach(() => {
  membersMock.mockReset()
  accountsMock.mockReset()
  categoriesMock.mockReset()
  membersMock.mockReturnValue({ data: [{ display_name: 'Alexis Lopez' }] })
  accountsMock.mockReturnValue({ data: [{ id: 'a1', name: 'Citibank' }] })
  categoriesMock.mockReturnValue({ data: [{ id: 'c1', name: 'Food & Dining' }] })
})

describe('<FilterChips> orchestrator', () => {
  it('renders all seven filter children when given default filters', () => {
    render(<FilterChips filters={{}} onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/search descriptions/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter by date/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter by account/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter by category/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter by member/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter by amount/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter by type/i })).toBeInTheDocument()
  })

  it('shows the Reset button only when filters are non-empty', () => {
    const { rerender } = render(<FilterChips filters={{}} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: /^reset$/i })).toBeNull()
    rerender(<FilterChips filters={{ member: 'Alexis Lopez' }} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /^reset$/i })).toBeInTheDocument()
  })

  it('renders set state for member when filters.member is set', () => {
    render(<FilterChips filters={{ member: 'Alexis Lopez' }} onChange={() => {}} />)
    expect(
      screen.getByRole('button', { name: /clear member filter \(alexis lopez\)/i })
    ).toBeInTheDocument()
  })
})
