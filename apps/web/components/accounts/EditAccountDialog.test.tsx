import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountRow } from '@/lib/data/accounts'

const mockMutateAsync = vi.fn()
const mockUseUpdate = vi.fn(() => ({ mutateAsync: mockMutateAsync, isPending: false }))

vi.mock('@/lib/data/accounts', async () => ({
  useUpdateAccount: () => mockUseUpdate()
}))

import { EditAccountDialog } from './EditAccountDialog'

const HID = '00000000-0000-0000-0000-000000000001'

function makeAccount(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'a1',
    household_id: HID,
    name: 'Chase Checking',
    type: 'checking',
    institution: 'Chase',
    is_active: true,
    last_four: null,
    starting_balance: 1000,
    starting_balance_date: null,
    archived_at: null,
    currency: 'USD',
    display_order: null,
    created_at: null,
    ...over
  }
}

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockMutateAsync.mockResolvedValue(undefined)
})

describe('<EditAccountDialog>', () => {
  it('renders the form with the current account values pre-filled', () => {
    render(
      <EditAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={makeAccount({ starting_balance: 2500, starting_balance_date: '2025-01-01' })}
      />
    )

    expect(screen.getByLabelText(/name/i)).toHaveValue('Chase Checking')
    expect(screen.getByLabelText(/^type$/i)).toHaveValue('checking')
    expect(screen.getByLabelText(/institution/i)).toHaveValue('Chase')
    expect(screen.getByLabelText(/starting balance$/i)).toHaveValue(2500)
    expect(screen.getByLabelText(/starting balance date/i)).toHaveValue('2025-01-01')
  })

  it('submits the patch via the update mutation', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <EditAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        account={makeAccount()}
      />
    )

    const startingBalance = screen.getByLabelText(/starting balance$/i)
    await user.clear(startingBalance)
    await user.type(startingBalance, '5000')

    const date = screen.getByLabelText(/starting balance date/i)
    await user.type(date, '2025-03-01')

    await user.selectOptions(screen.getByLabelText(/^type$/i), 'savings')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        id: 'a1',
        patch: {
          name: 'Chase Checking',
          type: 'savings',
          institution: 'Chase',
          starting_balance: 5000,
          starting_balance_date: '2025-03-01'
        }
      })
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('blocks submit when starting balance is not a finite number', async () => {
    const user = userEvent.setup()
    render(
      <EditAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={makeAccount()}
      />
    )

    // Empty starting balance: we strip the `required` attribute so the browser
    // doesn't intercept the submission, then assert our own validation catches it.
    const startingBalance = screen.getByLabelText(/starting balance$/i)
    await user.clear(startingBalance)
    startingBalance.removeAttribute('required')

    const form = startingBalance.closest('form')!
    fireEvent.submit(form)

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/starting balance/i))
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('discards unsaved edits when the dialog closes and reopens', async () => {
    const user = userEvent.setup()
    const account = makeAccount()
    const { rerender } = render(
      <EditAccountDialog open={true} onOpenChange={vi.fn()} account={account} />
    )

    const name = screen.getByLabelText(/name/i)
    await user.clear(name)
    await user.type(name, 'Edited but not saved')

    // Close (parent unmounts/resets open) then reopen with the original row.
    rerender(<EditAccountDialog open={false} onOpenChange={vi.fn()} account={account} />)
    rerender(<EditAccountDialog open={true} onOpenChange={vi.fn()} account={account} />)

    await waitFor(() =>
      expect(screen.getByLabelText(/name/i)).toHaveValue('Chase Checking')
    )
  })
})
