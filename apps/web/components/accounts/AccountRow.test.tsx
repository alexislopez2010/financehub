import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountRow } from './AccountRow'
import type { AccountBalance } from '@/lib/accounts/balances'

function makeBalance(over: Partial<AccountBalance> = {}): AccountBalance {
  return {
    accountId: 'a1',
    name: 'Chase Checking',
    type: 'checking',
    owner: null,
    currentBalance: 1000,
    activity: 0,
    txCount: 0,
    ...over
  }
}

describe('<AccountRow>', () => {
  it('renders the pencil button when onEdit is provided', () => {
    render(<AccountRow balance={makeBalance()} onEdit={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /edit account chase checking/i })
    ).toBeInTheDocument()
  })

  it('hides the pencil button when onEdit is not provided', () => {
    render(<AccountRow balance={makeBalance()} />)
    expect(
      screen.queryByRole('button', { name: /edit account/i })
    ).not.toBeInTheDocument()
  })

  it('renders the owner badge when an owner is set', () => {
    render(<AccountRow balance={makeBalance({ owner: 'Alexis' })} />)
    expect(screen.getByText('Alexis')).toBeInTheDocument()
    expect(screen.getByTitle('Owned by Alexis')).toBeInTheDocument()
  })

  it('renders the shared badge with a distinct title for Shared accounts', () => {
    render(<AccountRow balance={makeBalance({ owner: 'Shared' })} />)
    expect(screen.getByText('Shared')).toBeInTheDocument()
    expect(screen.getByTitle('Shared account')).toBeInTheDocument()
  })

  it('omits the owner badge when owner is null', () => {
    const { container } = render(<AccountRow balance={makeBalance({ owner: null })} />)
    // Only the type badge should render under the name.
    expect(container.querySelectorAll('[title]').length).toBe(0)
  })
})
