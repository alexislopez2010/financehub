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

const CATEGORIES = [
  { id: 'cat-1', name: 'Groceries', type: 'expense' },
  { id: 'cat-2', name: 'Utilities', type: 'expense' },
  { id: 'cat-3', name: 'Bank Fees', type: 'expense' },
  { id: 'cat-inc', name: 'Salary', type: 'income' }
]

describe('<BulkActionsBar> assign-category action', () => {
  it('renders the Assign category button when onAssignCategory is provided', () => {
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={() => {}}
      />
    )
    expect(
      screen.getByRole('button', { name: /assign category to selected rows/i })
    ).toBeInTheDocument()
  })

  it('omits the Assign category button when onAssignCategory is not provided', () => {
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
      />
    )
    expect(screen.queryByRole('button', { name: /assign category/i })).toBeNull()
  })

  it('opens the dropdown showing (Uncategorized) plus each category grouped by type', async () => {
    const user = userEvent.setup()
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign category to selected rows/i }))

    expect(await screen.findByRole('menuitem', { name: /\(Uncategorized\)/ })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Groceries' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Utilities' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Bank Fees' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Salary' })).toBeInTheDocument()
  })

  it('renders EXPENSE and INCOME section labels with items alphabetical inside each section', async () => {
    const user = userEvent.setup()
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign category to selected rows/i }))

    // Radix renders Label as a non-menuitem element with the section text.
    expect(await screen.findByText('Expense')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()

    const items = screen.getAllByRole('menuitem')
    // First item is (Uncategorized) — kept at the top.
    expect(items[0]?.textContent).toMatch(/\(Uncategorized\)/)

    // Remaining items: Expense section alpha-sorted, then Income section.
    const rest = items.slice(1).map(el => el.textContent?.trim())
    expect(rest).toEqual(['Bank Fees', 'Groceries', 'Utilities', 'Salary'])
  })

  it('hides the INCOME section when no income categories are supplied', async () => {
    const user = userEvent.setup()
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={[{ id: 'e1', name: 'Groceries', type: 'expense' }]}
        onAssignCategory={() => {}}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign category to selected rows/i }))

    expect(await screen.findByText('Expense')).toBeInTheDocument()
    expect(screen.queryByText('Income')).toBeNull()
  })

  it('calls onAssignCategory with the picked income-section category id', async () => {
    const onAssignCategory = vi.fn()
    const user = userEvent.setup()

    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={onAssignCategory}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign category to selected rows/i }))
    const item = await screen.findByRole('menuitem', { name: 'Salary' })
    await user.click(item)

    expect(onAssignCategory).toHaveBeenCalledTimes(1)
    expect(onAssignCategory).toHaveBeenCalledWith('cat-inc')
  })

  it('calls onAssignCategory(null) when picking (Uncategorized)', async () => {
    const onAssignCategory = vi.fn()
    const user = userEvent.setup()

    render(
      <BulkActionsBar
        selectedIds={['t1', 't2']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={onAssignCategory}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign category to selected rows/i }))
    const uncategorized = await screen.findByRole('menuitem', { name: /\(Uncategorized\)/ })
    await user.click(uncategorized)

    expect(onAssignCategory).toHaveBeenCalledTimes(1)
    expect(onAssignCategory).toHaveBeenCalledWith(null)
  })

  it('calls onAssignCategory with the picked category id', async () => {
    const onAssignCategory = vi.fn()
    const user = userEvent.setup()

    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={onAssignCategory}
      />
    )

    await user.click(screen.getByRole('button', { name: /assign category to selected rows/i }))
    const item = await screen.findByRole('menuitem', { name: 'Groceries' })
    await user.click(item)

    expect(onAssignCategory).toHaveBeenCalledTimes(1)
    expect(onAssignCategory).toHaveBeenCalledWith('cat-1')
  })

  it('disables the Assign category button and shows "Assigning…" while isAssigningCategory is true', () => {
    render(
      <BulkActionsBar
        selectedIds={['t1']}
        onCancel={() => {}}
        onCompleted={() => {}}
        categories={CATEGORIES}
        onAssignCategory={() => {}}
        isAssigningCategory
      />
    )

    const btn = screen.getByRole('button', { name: /assign category to selected rows/i })
    expect(btn).toBeDisabled()
    expect(btn.textContent).toMatch(/Assigning…/)
  })
})
