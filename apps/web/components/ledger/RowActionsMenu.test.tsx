import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowActionsMenu, type RowActionsMenuProps } from './RowActionsMenu'

function renderMenu(over: Partial<RowActionsMenuProps> = {}) {
  const props: RowActionsMenuProps = {
    onPromote: vi.fn(),
    onDelete: vi.fn(),
    ...over
  }
  render(<RowActionsMenu {...props} />)
  return props
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Row actions' }))
}

describe('<RowActionsMenu> orphan-Transfer gating', () => {
  it('shows Pair + demote items when onPairTransfer + onDemoteToType are provided', async () => {
    const user = userEvent.setup()
    renderMenu({
      onPairTransfer: vi.fn(),
      onDemoteToType: vi.fn()
    })

    await openMenu(user)

    expect(screen.getByText('Pair with another transaction')).toBeInTheDocument()
    expect(screen.getByText('Change to expense')).toBeInTheDocument()
    expect(screen.getByText('Change to income')).toBeInTheDocument()
    expect(screen.getByText('Change to refund')).toBeInTheDocument()
    expect(screen.queryByText('Convert to transfer')).toBeNull()
    expect(screen.queryByText(/Unpair transfer/)).toBeNull()
  })

  it('shows Unpair but NOT demote items when only onUnpairTransfer is wired (paired row)', async () => {
    const user = userEvent.setup()
    renderMenu({
      onUnpairTransfer: vi.fn()
    })

    await openMenu(user)

    expect(screen.getByText('Unpair transfer')).toBeInTheDocument()
    expect(screen.queryByText('Change to expense')).toBeNull()
    expect(screen.queryByText('Change to income')).toBeNull()
    expect(screen.queryByText('Change to refund')).toBeNull()
    expect(screen.queryByText('Pair with another transaction')).toBeNull()
  })

  it('shows Convert (non-Transfer unpaired) but NOT Pair / demote', async () => {
    const user = userEvent.setup()
    renderMenu({
      onConvertToTransfer: vi.fn()
    })

    await openMenu(user)

    expect(screen.getByText('Convert to transfer')).toBeInTheDocument()
    expect(screen.queryByText('Pair with another transaction')).toBeNull()
    expect(screen.queryByText('Change to expense')).toBeNull()
  })

  it('clicking "Change to expense" fires the demote callback with "Expense"', async () => {
    const user = userEvent.setup()
    const onDemoteToType = vi.fn()
    renderMenu({
      onPairTransfer: vi.fn(),
      onDemoteToType
    })

    await openMenu(user)
    await user.click(screen.getByText('Change to expense'))

    expect(onDemoteToType).toHaveBeenCalledTimes(1)
    expect(onDemoteToType).toHaveBeenCalledWith('Expense')
  })

  it('clicking "Change to income" fires the demote callback with "Income"', async () => {
    const user = userEvent.setup()
    const onDemoteToType = vi.fn()
    renderMenu({
      onPairTransfer: vi.fn(),
      onDemoteToType
    })

    await openMenu(user)
    await user.click(screen.getByText('Change to income'))

    expect(onDemoteToType).toHaveBeenCalledWith('Income')
  })
})
