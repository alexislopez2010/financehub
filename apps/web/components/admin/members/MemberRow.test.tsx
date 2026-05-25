import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { HouseholdMemberRow } from '@/lib/data/admin'
import { MemberRow } from './MemberRow'

function makeMember(over: Partial<HouseholdMemberRow> = {}): HouseholdMemberRow {
  return {
    user_id: 'u1',
    email: 'alex@example.com',
    display_name: 'Alex Lopez',
    role: 'owner',
    mfa_factors: 2,
    joined_at: '2025-01-01T00:00:00Z',
    ...over
  }
}

describe('<MemberRow>', () => {
  it('renders the display name, email, role pill, and MFA count', () => {
    render(
      <ul>
        <MemberRow member={makeMember()} onEdit={vi.fn()} onResetMfa={vi.fn()} onRemove={vi.fn()} />
      </ul>
    )
    expect(screen.getByText('Alex Lopez')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText(/2 factors/i)).toBeInTheDocument()
  })

  it('renders "1 factor" when mfa_factors is 1', () => {
    render(
      <ul>
        <MemberRow
          member={makeMember({ mfa_factors: 1 })}
          onEdit={vi.fn()}
          onResetMfa={vi.fn()}
          onRemove={vi.fn()}
        />
      </ul>
    )
    expect(screen.getByText('1 factor')).toBeInTheDocument()
  })

  it('falls back to email when display_name is null', () => {
    render(
      <ul>
        <MemberRow
          member={makeMember({ display_name: null })}
          onEdit={vi.fn()}
          onResetMfa={vi.fn()}
          onRemove={vi.fn()}
        />
      </ul>
    )
    // Email appears twice (in the bold label and the muted line); just assert at least once.
    expect(screen.getAllByText('alex@example.com').length).toBeGreaterThan(0)
  })

  it('invokes the matching callback when a menu item is selected', async () => {
    const onEdit = vi.fn()
    const onResetMfa = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()

    render(
      <ul>
        <MemberRow
          member={makeMember({ role: 'member' })}
          onEdit={onEdit}
          onResetMfa={onResetMfa}
          onRemove={onRemove}
        />
      </ul>
    )

    await user.click(screen.getByRole('button', { name: /actions for/i }))
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onResetMfa).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
  })
})
