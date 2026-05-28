import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Tables } from '@/lib/supabase/database.types'
import { SelectAllRow, TransactionList } from './TransactionList'

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

const TX_IDS = ['t1', 't2', 't3'] as const

describe('<SelectAllRow>', () => {
  it('renders "Select all" + count when nothing is selected', () => {
    render(
      <SelectAllRow
        selectedIds={new Set()}
        txIds={[...TX_IDS]}
        onSelectAll={vi.fn()}
      />
    )
    expect(screen.getByText('Select all')).toBeInTheDocument()
    expect(screen.getByText('3 transactions filtered')).toBeInTheDocument()
    const cb = screen.getByRole('checkbox', { name: /Select all transactions/ }) as HTMLInputElement
    expect(cb.checked).toBe(false)
    expect(cb.indeterminate).toBe(false)
  })

  it('shows "X of N selected · Clear" when partial selection', () => {
    render(
      <SelectAllRow
        selectedIds={new Set(['t1'])}
        txIds={[...TX_IDS]}
        onSelectAll={vi.fn()}
      />
    )
    expect(screen.getByText('1 of 3 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    // Checkbox is in the indeterminate DOM state (set via ref/useEffect).
    const cb = screen.getByRole('checkbox', { name: /Select all transactions/ }) as HTMLInputElement
    expect(cb.indeterminate).toBe(true)
    expect(cb.checked).toBe(false)
  })

  it('shows "All selected" + "N of N selected · Clear" when all selected', () => {
    render(
      <SelectAllRow
        selectedIds={new Set(TX_IDS)}
        txIds={[...TX_IDS]}
        onSelectAll={vi.fn()}
      />
    )
    expect(screen.getByText('All selected')).toBeInTheDocument()
    expect(screen.getByText('3 of 3 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument()
    const cb = screen.getByRole('checkbox', { name: /Select all transactions/ }) as HTMLInputElement
    expect(cb.checked).toBe(true)
    expect(cb.indeterminate).toBe(false)
  })

  it('clicking checkbox when empty selects all visible ids', async () => {
    const user = userEvent.setup()
    const onSelectAll = vi.fn()
    render(
      <SelectAllRow
        selectedIds={new Set()}
        txIds={[...TX_IDS]}
        onSelectAll={onSelectAll}
      />
    )
    await user.click(screen.getByRole('checkbox', { name: /Select all transactions/ }))
    expect(onSelectAll).toHaveBeenCalledTimes(1)
    const next = onSelectAll.mock.calls[0]![0] as Set<string>
    expect([...next].sort()).toEqual([...TX_IDS].sort())
  })

  it('clicking checkbox when indeterminate clears the selection', async () => {
    const user = userEvent.setup()
    const onSelectAll = vi.fn()
    render(
      <SelectAllRow
        selectedIds={new Set(['t1'])}
        txIds={[...TX_IDS]}
        onSelectAll={onSelectAll}
      />
    )
    await user.click(screen.getByRole('checkbox', { name: /Select all transactions/ }))
    expect(onSelectAll).toHaveBeenCalledTimes(1)
    const next = onSelectAll.mock.calls[0]![0] as Set<string>
    expect(next.size).toBe(0)
  })

  it('clicking Clear when all selected clears the selection', async () => {
    const user = userEvent.setup()
    const onSelectAll = vi.fn()
    render(
      <SelectAllRow
        selectedIds={new Set(TX_IDS)}
        txIds={[...TX_IDS]}
        onSelectAll={onSelectAll}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onSelectAll).toHaveBeenCalledTimes(1)
    const next = onSelectAll.mock.calls[0]![0] as Set<string>
    expect(next.size).toBe(0)
  })
})

describe('<TransactionList> Select-all wiring', () => {
  it('renders the SelectAllRow above the first month group when selection props are wired', () => {
    render(
      <TransactionList
        transactions={[makeTx({ id: 't1' }), makeTx({ id: 't2', date: '2025-05-16' })]}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
        txIds={['t1', 't2']}
        onSelectAll={vi.fn()}
      />
    )
    expect(screen.getByRole('checkbox', { name: /Select all transactions/ })).toBeInTheDocument()
    expect(screen.getByText('2 transactions filtered')).toBeInTheDocument()
  })

  it('does NOT render the SelectAllRow when selection props are omitted', () => {
    render(
      <TransactionList
        transactions={[makeTx({ id: 't1' })]}
      />
    )
    expect(screen.queryByRole('checkbox', { name: /Select all transactions/ })).toBeNull()
  })
})

describe('<TransactionList> sort header + flat-vs-grouped rendering', () => {
  const TWO_MONTHS = [
    makeTx({ id: 'a', date: '2025-05-15', description: 'May tx' }),
    makeTx({ id: 'b', date: '2025-04-10', description: 'April tx' })
  ]

  it('renders month group headers when sort is null (grouped)', () => {
    render(<TransactionList transactions={TWO_MONTHS} sort={null} onSortChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'May 2025' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'April 2025' })).toBeInTheDocument()
  })

  it('renders flat (no month headers) and preserves row order when sort is set', () => {
    render(
      <TransactionList
        transactions={TWO_MONTHS}
        sort={{ key: 'amount', dir: 'desc' }}
        onSortChange={vi.fn()}
      />
    )
    // No month section headings in flat mode.
    expect(screen.queryByRole('heading', { name: 'May 2025' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'April 2025' })).toBeNull()
    // Rows render in the exact order the parent provided.
    const descriptions = screen.getAllByTitle(/tx$/).map(el => el.textContent)
    expect(descriptions).toEqual(['May tx', 'April tx'])
  })

  it('renders the SortableHeader when onSortChange is provided', () => {
    render(<TransactionList transactions={TWO_MONTHS} sort={null} onSortChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Sort by Amount' })).toBeInTheDocument()
  })

  it('does NOT render the SortableHeader when onSortChange is omitted', () => {
    render(<TransactionList transactions={TWO_MONTHS} />)
    expect(screen.queryByRole('button', { name: 'Sort by Amount' })).toBeNull()
  })
})
