import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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
        onCreateForUnbudgeted={noop}
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
        onCreateForUnbudgeted={noop}
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
        onCreateForUnbudgeted={noop}
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
        onCreateForUnbudgeted={noop}
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
        onCreateForUnbudgeted={noop}
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
        onCreateForUnbudgeted={noop}
      />
    )
    expect(onEdit).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })
})
