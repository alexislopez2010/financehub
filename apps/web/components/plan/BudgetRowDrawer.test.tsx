import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BudgetRowDrawer } from './BudgetRowDrawer'
import type { TransactionRow } from '@/lib/finance/types'

let counter = 0
function tx(over: Partial<TransactionRow>): TransactionRow {
  counter += 1
  return {
    id: over.id ?? `tx-${counter}`,
    household_id: 'h',
    date: over.date ?? '2026-06-15',
    description: over.description ?? '',
    amount: over.amount ?? -10,
    type: over.type ?? 'Expense',
    category: over.category ?? null,
    category_id: over.category_id ?? null,
    account: over.account ?? null,
    member: over.member ?? null,
    transfer_pair_id: over.transfer_pair_id ?? null
  }
}

describe('<BudgetRowDrawer>', () => {
  it('renders an empty-state message when no transactions are supplied', () => {
    render(
      <BudgetRowDrawer
        category="Housing"
        transactions={[]}
        totalActual={0}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/no transactions contribute/i)).toBeInTheDocument()
  })

  it('lists every supplied transaction with date, description, and amount', () => {
    render(
      <BudgetRowDrawer
        category="Housing"
        transactions={[
          tx({ date: '2026-06-01', description: 'Mortgage payment', amount: -2469 }),
          tx({ date: '2026-06-15', description: 'HOA dues',          amount: -85 })
        ]}
        totalActual={2554}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/Mortgage payment/)).toBeInTheDocument()
    expect(screen.getByText(/HOA dues/)).toBeInTheDocument()
    // Absolute amounts
    expect(screen.getByText(/\$2,469/)).toBeInTheDocument()
    expect(screen.getByText(/\$85/)).toBeInTheDocument()
    // Singular/plural counter (text spans multiple nodes; assert on the
    // container's textContent instead of a single text node).
    const header = screen.getByText(/sum to/i)
    expect(header.textContent ?? '').toMatch(/2\s+transactions/)
  })

  it('uses singular phrasing for a single transaction', () => {
    render(
      <BudgetRowDrawer
        category="Housing"
        transactions={[tx({ description: 'Mortgage', amount: -2469 })]}
        totalActual={2469}
        onClose={() => {}}
      />
    )
    const header = screen.getByText(/sum to/i)
    const text = header.textContent ?? ''
    expect(text).toMatch(/1\s+transaction\b/)
    expect(text).not.toMatch(/transactions\b/)
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <BudgetRowDrawer
        category="Housing"
        transactions={[tx({ description: 'A', amount: -10 })]}
        totalActual={10}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders a fallback when description is empty', () => {
    render(
      <BudgetRowDrawer
        category="X"
        transactions={[tx({ description: '', amount: -50 })]}
        totalActual={50}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/no description/i)).toBeInTheDocument()
  })

  it('surfaces account + member badges when present', () => {
    render(
      <BudgetRowDrawer
        category="X"
        transactions={[
          tx({ description: 'Coffee', amount: -10, account: 'Chase Checking', member: 'Alexis' })
        ]}
        totalActual={10}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/Chase Checking/)).toBeInTheDocument()
    expect(screen.getByText(/Alexis/)).toBeInTheDocument()
  })

  describe('category recategorize', () => {
    const options: ReadonlyArray<{ value: string; label: string }> = [
      { value: 'cat-food', label: 'Food' },
      { value: 'cat-fun', label: 'Entertainment' }
    ]

    it('renders the current category as a clickable chip when categoryOptions + onUpdateCategory are supplied', () => {
      render(
        <BudgetRowDrawer
          category="Food"
          transactions={[tx({ id: 't1', description: 'Pizza', category: 'Food', category_id: 'cat-food', amount: -25 })]}
          totalActual={25}
          onClose={() => {}}
          categoryOptions={options}
          onUpdateCategory={() => {}}
        />
      )
      // Display button reads "Food" — the EditableCell renders this as a button
      // (not the underlying select) until it enters edit mode.
      expect(screen.getByRole('button', { name: /food/i })).toBeInTheDocument()
    })

    it('calls onUpdateCategory(txId, nextCategoryId) when the user picks a new category', () => {
      const onUpdate = vi.fn()
      render(
        <BudgetRowDrawer
          category="Food"
          transactions={[tx({ id: 't1', description: 'Pizza', category: 'Food', category_id: 'cat-food', amount: -25 })]}
          totalActual={25}
          onClose={() => {}}
          categoryOptions={options}
          onUpdateCategory={onUpdate}
        />
      )
      // Click the chip to enter edit mode, then change the select value.
      fireEvent.click(screen.getByRole('button', { name: /food/i }))
      const select = screen.getByRole('combobox') as HTMLSelectElement
      fireEvent.change(select, { target: { value: 'cat-fun' } })
      // EditableCell commits on blur.
      fireEvent.blur(select)
      expect(onUpdate).toHaveBeenCalledWith('t1', 'cat-fun')
    })

    it('allows clearing the category by picking the leading "(uncategorized)" option', () => {
      const onUpdate = vi.fn()
      render(
        <BudgetRowDrawer
          category="Food"
          transactions={[tx({ id: 't1', description: 'Pizza', category: 'Food', category_id: 'cat-food', amount: -25 })]}
          totalActual={25}
          onClose={() => {}}
          categoryOptions={options}
          onUpdateCategory={onUpdate}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: /food/i }))
      const select = screen.getByRole('combobox') as HTMLSelectElement
      fireEvent.change(select, { target: { value: '' } })
      fireEvent.blur(select)
      expect(onUpdate).toHaveBeenCalledWith('t1', '')
    })

    it('keeps the category as static text when no edit handler is provided (back-compat)', () => {
      render(
        <BudgetRowDrawer
          category="Food"
          transactions={[tx({ id: 't1', description: 'Pizza', category: 'Food', category_id: 'cat-food', amount: -25 })]}
          totalActual={25}
          onClose={() => {}}
        />
      )
      // No clickable category button is rendered — only the close button + textual content.
      expect(screen.queryByRole('button', { name: /food/i })).not.toBeInTheDocument()
    })
  })
})
