import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockDeleteMutate = vi.fn(async (_id: string) => undefined)
const mockUseDeleteTransaction = vi.fn(() => ({
  mutateAsync: mockDeleteMutate
}))

vi.mock('@/lib/data/transactions', () => ({
  useDeleteTransaction: () => mockUseDeleteTransaction()
}))

import { BulkActionsBar } from './BulkActionsBar'

const ROSTER = [
  { display_name: 'Alexis Lopez' },
  { display_name: 'Marilyn Lopez' }
]

beforeEach(() => {
  mockDeleteMutate.mockClear()
  mockUseDeleteTransaction.mockClear()
})

describe('<BulkActionsBar> assign-member action', () => {
  it('renders the Assign member button when ≥1 row is selected and onAssignMember is wired', () => {
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        members={ROSTER}
        onAssignMember={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /assign member to selected rows/i })).toBeInTheDocument()
  })

  it('omits the Assign member button when onAssignMember is not provided', () => {
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: /assign member/i })).toBeNull()
  })

  it('opens the dropdown and calls onAssignMember with the picked member', async () => {
    const onAssignMember = vi.fn()
    const user = userEvent.setup()

    render(
      <BulkActionsBar
        selectedIds={['t1', 't2']}
        onCancel={() => {}}
        onCompleted={() => {}}
        members={ROSTER}
        onAssignMember={onAssignMember}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign member to selected rows/i }))

    const item = await screen.findByRole('menuitem', { name: 'Marilyn Lopez' })
    await user.click(item)

    expect(onAssignMember).toHaveBeenCalledTimes(1)
    expect(onAssignMember).toHaveBeenCalledWith('Marilyn Lopez')
  })

  it('exposes the "(Unassigned)" option so multi-row clears work', async () => {
    const onAssignMember = vi.fn()
    const user = userEvent.setup()

    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        members={ROSTER}
        onAssignMember={onAssignMember}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign member to selected rows/i }))

    const unassigned = await screen.findByRole('menuitem', { name: /\(Unassigned\)/ })
    await user.click(unassigned)

    expect(onAssignMember).toHaveBeenCalledWith(null)
  })

  it('disables the Assign member button and shows "Assigning…" while isAssigning is true', () => {
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        members={ROSTER}
        onAssignMember={() => {}}
        isAssigning
      />
    )

    const btn = screen.getByRole('button', { name: /assign member to selected rows/i })
    expect(btn).toBeDisabled()
    expect(btn.textContent).toMatch(/Assigning…/)
  })
})
