import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { HouseholdMemberRow } from '@/lib/data/admin'

const mockUseHouseholdMembers = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseReset = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseRemove = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))

vi.mock('@/lib/data/admin', async () => {
  return {
    useHouseholdMembers: () => mockUseHouseholdMembers(),
    useUpdateHouseholdMember: () => mockUseUpdate(),
    useResetMfa: () => mockUseReset(),
    useRemoveHouseholdMember: () => mockUseRemove()
  }
})

import { MembersSection } from './MembersSection'

function makeMember(over: Partial<HouseholdMemberRow> = {}): HouseholdMemberRow {
  return {
    user_id: 'u1',
    email: 'alex@example.com',
    display_name: 'Alex',
    role: 'owner',
    mfa_factors: 2,
    joined_at: '2025-01-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  mockUseHouseholdMembers.mockReset()
})

describe('<MembersSection>', () => {
  it('shows a loading message while the query is loading', () => {
    mockUseHouseholdMembers.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<MembersSection />)
    // The header shows "Loading…" and the body shows "Loading…" too — assert via getAllByText.
    expect(screen.getAllByText(/loading/i).length).toBeGreaterThan(0)
  })

  it('renders rows when the query resolves', () => {
    mockUseHouseholdMembers.mockReturnValue({
      data: [
        makeMember(),
        makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob', role: 'member', mfa_factors: 1 })
      ],
      isLoading: false,
      error: null
    })
    render(<MembersSection />)
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('2 members in this household')).toBeInTheDocument()
  })

  it('renders the error message when the query errors', () => {
    mockUseHouseholdMembers.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('not authorized')
    })
    render(<MembersSection />)
    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load members.*not authorized/i)
  })
})
