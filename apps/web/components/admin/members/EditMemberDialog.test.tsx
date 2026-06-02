import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdMemberRow } from '@/lib/data/admin'

const mockMutateAsync = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))

vi.mock('@/lib/data/admin', async () => ({
  useUpdateHouseholdMember: () => mockUseUpdate()
}))

import { EditMemberDialog } from './EditMemberDialog'

function makeMember(over: Partial<HouseholdMemberRow> = {}): HouseholdMemberRow {
  return {
    user_id: 'u1',
    email: 'alex@example.com',
    display_name: 'Alex',
    role: 'member',
    mfa_factors: 0,
    joined_at: '2025-01-01T00:00:00Z',
    is_active: true,
    ...over
  }
}

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockMutateAsync.mockResolvedValue(undefined)
})

describe('<EditMemberDialog>', () => {
  it('submits the patch via the update mutation', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<EditMemberDialog member={makeMember()} onClose={onClose} />)

    const name = screen.getByLabelText(/display name/i)
    await user.clear(name)
    await user.type(name, 'Alexis')

    // Switch role to owner via the segmented control.
    await user.click(screen.getByRole('button', { name: 'owner' }))

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        target_user: 'u1',
        patch: { display_name: 'Alexis', role: 'owner' }
      })
    )
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('surfaces the PG exception message when the mutation rejects', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('cannot demote the last owner'))
    const user = userEvent.setup()
    render(<EditMemberDialog member={makeMember({ role: 'owner' })} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'member' }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/cannot demote the last owner/i)
    )
  })
})
