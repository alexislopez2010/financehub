import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AccountRow } from './AccountRow'
import type { AccountBalance } from '@/lib/accounts/balances'

function makeBalance(over: Partial<AccountBalance> = {}): AccountBalance {
  return {
    accountId: 'a1',
    name: 'Chase Checking',
    type: 'checking',
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
})
