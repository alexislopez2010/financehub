import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BudgetRow } from './BudgetRow'
import type { BudgetVsActualRow } from '@/lib/plan/budgetVsActual'

function row(over: Partial<BudgetVsActualRow> = {}): BudgetVsActualRow {
  return {
    budgetId: 'b1',
    category: 'Housing',
    categoryId: 'cat-housing',
    budgeted: 1000,
    actual: 200,
    variance: 800,
    billsCommitted: 0,
    billsCoverage: 0,
    billsOverCommitted: false,
    ...over
  }
}

const noop = () => {}

describe('<BudgetRow> bills column', () => {
  it('shows formatted billsCommitted amount when > 0', () => {
    render(
      <BudgetRow
        row={row({ billsCommitted: 1500, billsCoverage: 1.5, billsOverCommitted: true })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    // Bills committed amount renders in both the desktop column and the mobile subline.
    const allBillsText = screen.getAllByText(/\$1,500/)
    expect(allBillsText.length).toBeGreaterThanOrEqual(1)
  })

  it('renders a muted em-dash when no bills are committed', () => {
    render(
      <BudgetRow
        row={row({ billsCommitted: 0 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders an over-committed badge and red text when bills exceed budget', () => {
    const { container } = render(
      <BudgetRow
        row={row({
          budgeted: 1000,
          billsCommitted: 1500,
          billsCoverage: 1.5,
          billsOverCommitted: true
        })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    expect(screen.getByLabelText('Bills exceed this budget')).toBeInTheDocument()
    // At least one element rendering the bills amount is in red.
    const reds = container.querySelectorAll('.text-red-600')
    expect(reds.length).toBeGreaterThan(0)
  })

  it('does not render the over-committed badge when bills are within budget', () => {
    render(
      <BudgetRow
        row={row({ budgeted: 1000, billsCommitted: 500, billsCoverage: 0.5 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    expect(screen.queryByLabelText('Bills exceed this budget')).not.toBeInTheDocument()
  })

  it('surfaces bills in a mobile-only subline below the category name', () => {
    const { container } = render(
      <BudgetRow
        row={row({ billsCommitted: 250 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    // The mobile subline is the only element marked `md:hidden` that mentions "bills:".
    const subline = container.querySelector('.md\\:hidden')
    expect(subline?.textContent ?? '').toMatch(/bills:\s*\$250/)
  })

  it('does not call onEditBudget or onDelete when bills column renders', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    render(
      <BudgetRow
        row={row({ billsCommitted: 100 })}
        onEditBudget={onEdit}
        onDelete={onDelete}
        onCreateBudget={noop}
      />
    )
    expect(onEdit).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('<BudgetRow> actuals drill-down', () => {
  it('renders the actual amount as a button that fires onToggleActuals when clicked', () => {
    const onToggle = vi.fn()
    render(
      <BudgetRow
        row={row({ actual: 1234.56 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
        onToggleActuals={onToggle}
        isActualsOpen={false}
      />
    )
    const btn = screen.getByRole('button', { name: /show transactions for Housing/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('reports aria-expanded=true when the drawer is open', () => {
    render(
      <BudgetRow
        row={row({ actual: 100 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
        onToggleActuals={noop}
        isActualsOpen={true}
      />
    )
    expect(screen.getByRole('button', { name: /show transactions/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders the actual amount as plain text when actual is zero (nothing to drill into)', () => {
    render(
      <BudgetRow
        row={row({ actual: 0 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
        onToggleActuals={noop}
      />
    )
    expect(screen.queryByRole('button', { name: /show transactions/i })).not.toBeInTheDocument()
  })

  it('renders the actual amount as plain text when no onToggleActuals is supplied (back-compat)', () => {
    render(
      <BudgetRow
        row={row({ actual: 500 })}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    expect(screen.queryByRole('button', { name: /show transactions/i })).not.toBeInTheDocument()
  })
})

describe('<BudgetRow> inline-add for unbudgeted rows', () => {
  function unbudgeted(over: Partial<BudgetVsActualRow> = {}): BudgetVsActualRow {
    return row({
      budgetId: null,
      categoryId: null,
      category: 'Cash & ATM',
      budgeted: 0,
      actual: 6200,
      variance: -6200,
      billsCommitted: 0,
      billsCoverage: null,
      billsOverCommitted: false,
      ...over
    })
  }

  it('shows "+ Add a budget for this" trigger on actuals-only rows', () => {
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    expect(screen.getByRole('button', { name: /\+ Add a budget for this/i })).toBeInTheDocument()
  })

  it('reveals an amount input when the trigger is clicked', () => {
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Add a budget for this/i }))
    expect(screen.getByLabelText('Budget amount for Cash & ATM')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onCreateBudget with the parsed amount when Save is clicked', () => {
    const onCreate = vi.fn()
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={onCreate}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Add a budget for this/i }))
    const input = screen.getByLabelText('Budget amount for Cash & ATM')
    fireEvent.change(input, { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onCreate).toHaveBeenCalledWith(250)
  })

  it('commits on Enter key', () => {
    const onCreate = vi.fn()
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={onCreate}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Add a budget for this/i }))
    const input = screen.getByLabelText('Budget amount for Cash & ATM')
    fireEvent.change(input, { target: { value: '500' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreate).toHaveBeenCalledWith(500)
  })

  it('reverts to the trigger on Cancel without calling onCreateBudget', () => {
    const onCreate = vi.fn()
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={onCreate}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Add a budget for this/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /\+ Add a budget for this/i })).toBeInTheDocument()
  })

  it('reverts to the trigger on Escape key', () => {
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={noop}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Add a budget for this/i }))
    fireEvent.keyDown(screen.getByLabelText('Budget amount for Cash & ATM'), { key: 'Escape' })
    expect(screen.getByRole('button', { name: /\+ Add a budget for this/i })).toBeInTheDocument()
  })

  it('does not call onCreateBudget when the amount is empty or zero', () => {
    const onCreate = vi.fn()
    render(
      <BudgetRow
        row={unbudgeted()}
        onEditBudget={noop}
        onDelete={noop}
        onCreateBudget={onCreate}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /\+ Add a budget for this/i }))
    // Empty
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onCreate).not.toHaveBeenCalled()
    // Zero
    fireEvent.change(screen.getByLabelText('Budget amount for Cash & ATM'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(onCreate).not.toHaveBeenCalled()
  })
})
