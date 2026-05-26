import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Tables } from '@/lib/supabase/database.types'
import { TransactionRow } from './TransactionRow'

type TxRow = Tables<'transactions'>

function makeTx(over: Partial<TxRow> = {}): TxRow {
  return {
    id: 't1',
    household_id: 'h1',
    date: '2025-05-15',
    description: 'Coffee',
    amount: 4.5,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    account_id: null,
    member: null,
    created_at: null,
    fingerprint: null,
    imported_at: null,
    notes: null,
    payment_method: null,
    sub_category: null,
    transfer_group_id: null,
    transfer_pair_id: null,
    ...over
  } as TxRow
}

const ROSTER = [
  { display_name: 'Alexis Lopez' },
  { display_name: 'Marilyn Lopez' }
]

describe('<TransactionRow> member column', () => {
  it('renders the member display name when set', () => {
    render(
      <TransactionRow
        tx={makeTx({ member: 'Alexis Lopez' })}
        members={ROSTER}
      />
    )
    // Two "Alexis Lopez" matches could theoretically exist (display + a11y);
    // assert at least one is visible.
    const matches = screen.getAllByText('Alexis Lopez')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders muted italic "Unassigned" when member is null', () => {
    render(<TransactionRow tx={makeTx({ member: null })} members={ROSTER} />)
    const el = screen.getByText('Unassigned')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/italic/)
    expect(el.className).toMatch(/text-muted/)
  })

  it('clicking the cell and picking a different option fires onEditMember with the correct value', async () => {
    const onEditMember = vi.fn()
    const user = userEvent.setup()

    render(
      <TransactionRow
        tx={makeTx({ member: null })}
        members={ROSTER}
        onEditMember={onEditMember}
      />
    )

    // Enter edit mode by clicking the cell button (label "Unassigned").
    await user.click(screen.getByRole('button', { name: /Unassigned/ }))

    // EditableCell renders a native <select>; pick 'Marilyn Lopez'.
    const select = screen.getByRole('combobox')
    await user.selectOptions(select, 'Marilyn Lopez')

    // Commit happens on blur.
    await user.tab()

    expect(onEditMember).toHaveBeenCalledTimes(1)
    expect(onEditMember).toHaveBeenCalledWith('Marilyn Lopez')
  })

  it('picking the Unassigned option fires onEditMember with null', async () => {
    const onEditMember = vi.fn()
    const user = userEvent.setup()

    render(
      <TransactionRow
        tx={makeTx({ member: 'Alexis Lopez' })}
        members={ROSTER}
        onEditMember={onEditMember}
      />
    )

    await user.click(screen.getByRole('button', { name: /Alexis Lopez/ }))
    const select = screen.getByRole('combobox')
    // The Unassigned option's <option value="__unassigned__"> — userEvent
    // matches by visible label; we pass the display label.
    await user.selectOptions(select, '(Unassigned)')
    await user.tab()

    expect(onEditMember).toHaveBeenCalledTimes(1)
    expect(onEditMember).toHaveBeenCalledWith(null)
  })
})
