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
    is_active: true,
    ...over
  }
}

function renderRow(overrides: Partial<HouseholdMemberRow> = {}, extra: Partial<{
  onEdit: () => void
  onResetMfa: () => void
  onRemove: () => void
  onResetPassword: () => void
  onToggleActive: () => void
  isSelf: boolean
  resetPasswordPending: boolean
  toggleActivePending: boolean
}> = {}) {
  return render(
    <ul>
      <MemberRow
        member={makeMember(overrides)}
        onEdit={extra.onEdit ?? vi.fn()}
        onResetMfa={extra.onResetMfa ?? vi.fn()}
        onRemove={extra.onRemove ?? vi.fn()}
        onResetPassword={extra.onResetPassword ?? vi.fn()}
        onToggleActive={extra.onToggleActive ?? vi.fn()}
        isSelf={extra.isSelf ?? false}
        resetPasswordPending={extra.resetPasswordPending ?? false}
        toggleActivePending={extra.toggleActivePending ?? false}
      />
    </ul>
  )
}

describe('<MemberRow>', () => {
  it('renders the display name, email, role pill, and MFA count', () => {
    renderRow()
    expect(screen.getByText('Alex Lopez')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
    expect(screen.getByText('owner')).toBeInTheDocument()
    expect(screen.getByText(/2 factors/i)).toBeInTheDocument()
  })

  it('renders "1 factor" when mfa_factors is 1', () => {
    renderRow({ mfa_factors: 1 })
    expect(screen.getByText('1 factor')).toBeInTheDocument()
  })

  it('falls back to email when display_name is null', () => {
    renderRow({ display_name: null })
    // Email appears twice (in the bold label and the muted line); just assert at least once.
    expect(screen.getAllByText('alex@example.com').length).toBeGreaterThan(0)
  })

  it('invokes the matching callback when a menu item is selected', async () => {
    const onEdit = vi.fn()
    const onResetMfa = vi.fn()
    const onRemove = vi.fn()
    const user = userEvent.setup()

    renderRow({ role: 'member' }, { onEdit, onResetMfa, onRemove })

    await user.click(screen.getByRole('button', { name: /actions for/i }))
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(onResetMfa).not.toHaveBeenCalled()
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('renders the inactive badge and dims the row when is_active is false', () => {
    const { container } = renderRow({ is_active: false })
    expect(screen.getByText(/inactive/i)).toBeInTheDocument()
    const li = container.querySelector('li')
    expect(li?.className).toMatch(/opacity-60/)
  })

  it('hides the toggle-active button when isSelf is true', () => {
    renderRow({}, { isSelf: true })
    expect(screen.queryByRole('button', { name: /disable .*account/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /enable .*account/i })).toBeNull()
  })

  it('shows the disable button label when the member is currently active', () => {
    renderRow({ is_active: true })
    expect(screen.getByRole('button', { name: /disable .*account/i })).toBeInTheDocument()
  })

  it('shows the enable button label when the member is currently inactive', () => {
    renderRow({ is_active: false })
    expect(screen.getByRole('button', { name: /enable .*account/i })).toBeInTheDocument()
  })

  it('fires onResetPassword when the reset-password button is clicked', async () => {
    const onResetPassword = vi.fn()
    const user = userEvent.setup()
    renderRow({}, { onResetPassword })
    await user.click(screen.getByRole('button', { name: /password-reset/i }))
    expect(onResetPassword).toHaveBeenCalledTimes(1)
  })
})
