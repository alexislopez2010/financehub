import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { HouseholdMemberRow } from '@/lib/data/admin'

const mockMutateAsync = vi.fn()
const mockUseRemove = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))

vi.mock('@/lib/data/admin', async () => ({
  useRemoveHouseholdMember: () => mockUseRemove()
}))

import { RemoveMemberDialog } from './RemoveMemberDialog'

function makeMember(over: Partial<HouseholdMemberRow> = {}): HouseholdMemberRow {
  return {
    user_id: 'u1',
    email: 'a@example.com',
    display_name: 'Alex',
    role: 'member',
    mfa_factors: 0,
    joined_at: '2025-01-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockMutateAsync.mockResolvedValue(undefined)
})

describe('<RemoveMemberDialog>', () => {
  it('disables the Remove button when the member is an owner and shows the demote hint', () => {
    render(<RemoveMemberDialog member={makeMember({ role: 'owner' })} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /remove/i })).toBeDisabled()
    expect(screen.getByRole('note')).toHaveTextContent(/demote them to member first/i)
  })

  it('enables the Remove button for a member-role row', () => {
    render(<RemoveMemberDialog member={makeMember({ role: 'member' })} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /remove/i })).toBeEnabled()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
