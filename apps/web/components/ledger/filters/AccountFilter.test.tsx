import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUseAccounts = vi.fn<() => { data: ReadonlyArray<{ id: string; name: string }> }>()

vi.mock('@/lib/data/accounts', () => ({
  useAccounts: () => mockUseAccounts()
}))

import { AccountFilter } from './AccountFilter'

beforeEach(() => {
  mockUseAccounts.mockReset()
  mockUseAccounts.mockReturnValue({
    data: [
      { id: 'a1', name: 'Citibank' },
      { id: 'a2', name: 'Capital One' }
    ]
  })
})

describe('<AccountFilter>', () => {
  it('renders "Account ▼" trigger when value is undefined', () => {
    render(<AccountFilter value={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /filter by account/i })).toBeInTheDocument()
  })

  it('renders set state with value + clear button', () => {
    render(<AccountFilter value="Citibank" onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear account filter \(citibank\)/i })
    expect(chip.textContent).toMatch(/Citibank/)
  })

  it('clicking clear chip calls onChange(undefined)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<AccountFilter value="Citibank" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /clear account filter/i }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('picking an account fires onChange with the account name', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<AccountFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by account/i }))
    const item = await screen.findByRole('menuitem', { name: 'Capital One' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith('Capital One')
  })
})
