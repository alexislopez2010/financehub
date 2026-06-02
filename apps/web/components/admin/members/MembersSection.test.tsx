import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdMemberRow } from '@/lib/data/admin'

const mockUseHouseholdMembers = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseResetMfa = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseRemove = vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false }))
const mockUseAdd = vi.fn(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  data: undefined,
  reset: vi.fn()
}))

const mockResetPasswordMutate = vi.fn()
const mockSetActiveMutate = vi.fn()
const mockUseResetPassword = vi.fn(() => ({
  mutateAsync: mockResetPasswordMutate,
  isPending: false
}))
const mockUseSetActive = vi.fn(() => ({
  mutateAsync: mockSetActiveMutate,
  isPending: false
}))

vi.mock('@/lib/data/admin', async () => {
  return {
    useHouseholdMembers: () => mockUseHouseholdMembers(),
    useUpdateHouseholdMember: () => mockUseUpdate(),
    useResetMfa: () => mockUseResetMfa(),
    useRemoveHouseholdMember: () => mockUseRemove(),
    useAddHouseholdMember: () => mockUseAdd(),
    useResetHouseholdMemberPassword: () => mockUseResetPassword(),
    useSetHouseholdMemberActive: () => mockUseSetActive()
  }
})

// Reflective default — `getUser` resolves to null user; specific tests override.
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null } })
vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: { getUser: () => mockGetUser() }
  })
}))

import { MembersSection } from './MembersSection'

function makeMember(over: Partial<HouseholdMemberRow> = {}): HouseholdMemberRow {
  return {
    user_id: 'u1',
    email: 'alex@example.com',
    display_name: 'Alex',
    role: 'owner',
    mfa_factors: 2,
    joined_at: '2025-01-01T00:00:00Z',
    is_active: true,
    ...over
  }
}

beforeEach(() => {
  mockUseHouseholdMembers.mockReset()
  mockResetPasswordMutate.mockReset()
  mockSetActiveMutate.mockReset()
  mockGetUser.mockReset()
  mockGetUser.mockResolvedValue({ data: { user: null } })
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

  it('fires the reset-password mutation with the right args after confirming', async () => {
    mockUseHouseholdMembers.mockReturnValue({
      data: [makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob', role: 'member' })],
      isLoading: false,
      error: null
    })
    mockResetPasswordMutate.mockResolvedValue({ email: 'b@example.com' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const user = userEvent.setup()
    render(<MembersSection />)

    await user.click(screen.getByRole('button', { name: /password-reset email to bob/i }))

    await waitFor(() =>
      expect(mockResetPasswordMutate).toHaveBeenCalledWith({
        household_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: 'u2'
      })
    )

    expect(await screen.findByText(/password reset email sent to b@example.com/i)).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('does not call the reset-password mutation if the user cancels the confirm dialog', async () => {
    mockUseHouseholdMembers.mockReturnValue({
      data: [makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob', role: 'member' })],
      isLoading: false,
      error: null
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    const user = userEvent.setup()
    render(<MembersSection />)

    await user.click(screen.getByRole('button', { name: /password-reset email to bob/i }))
    expect(mockResetPasswordMutate).not.toHaveBeenCalled()
    confirmSpy.mockRestore()
  })

  it('shows the Enable button label when the member is currently inactive', () => {
    mockUseHouseholdMembers.mockReturnValue({
      data: [makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob', role: 'member', is_active: false })],
      isLoading: false,
      error: null
    })
    render(<MembersSection />)
    expect(screen.getByRole('button', { name: /enable bob's account/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /disable bob's account/i })).toBeNull()
  })

  it('hides the toggle-active button for the current user (self-disable guard)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u-self' } } })
    mockUseHouseholdMembers.mockReturnValue({
      data: [
        makeMember({ user_id: 'u-self', email: 'me@example.com', display_name: 'Me', role: 'owner' }),
        makeMember({ user_id: 'u-other', email: 'b@example.com', display_name: 'Bob', role: 'member' })
      ],
      isLoading: false,
      error: null
    })

    render(<MembersSection />)

    // Wait for getUser to resolve and the self-row to drop the toggle.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /disable me's account/i })).toBeNull()
    })

    // The other member still has a toggle.
    expect(screen.getByRole('button', { name: /disable bob's account/i })).toBeInTheDocument()
  })

  it('renders the Inactive badge for disabled members', () => {
    mockUseHouseholdMembers.mockReturnValue({
      data: [
        makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob', role: 'member', is_active: false })
      ],
      isLoading: false,
      error: null
    })
    render(<MembersSection />)
    expect(screen.getByText(/inactive/i)).toBeInTheDocument()
  })
})
