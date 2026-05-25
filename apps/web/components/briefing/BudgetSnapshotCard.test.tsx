import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { BudgetSnapshot } from '@/lib/briefing/budgetSnapshot'
import { BudgetSnapshotCard } from './BudgetSnapshotCard'

const underSnapshot: BudgetSnapshot = {
  totalBudgeted: 1000,
  totalSpent: 400,
  utilization: 0.4,
  remaining: 600,
  status: 'under'
}

const overSnapshot: BudgetSnapshot = {
  totalBudgeted: 1000,
  totalSpent: 1250,
  utilization: 1.25,
  remaining: -250,
  status: 'over'
}

const noBudgetSnapshot: BudgetSnapshot = {
  totalBudgeted: 0,
  totalSpent: 320,
  utilization: null,
  remaining: -320,
  status: 'under'
}

describe('<BudgetSnapshotCard>', () => {
  it('renders header + spent of budgeted + remaining caption (under)', () => {
    render(<BudgetSnapshotCard snapshot={underSnapshot} monthLabel="May 2026" />)
    expect(screen.getByText('Budget — This Month')).toBeInTheDocument()
    expect(screen.getByText('May 2026')).toBeInTheDocument()
    expect(screen.getByText('$400')).toBeInTheDocument()
    expect(screen.getByText(/of \$1,000/)).toBeInTheDocument()
    expect(screen.getByText('$600')).toBeInTheDocument()
    expect(screen.getByText(/remaining · 40% used/)).toBeInTheDocument()
  })

  it('renders over-budget state with red bar + over caption', () => {
    const { container } = render(
      <BudgetSnapshotCard snapshot={overSnapshot} monthLabel="May 2026" />
    )
    expect(screen.getByText('$250')).toBeInTheDocument()
    expect(screen.getByText(/over budget · 125% used/)).toBeInTheDocument()
    expect(container.querySelector('div.bg-red-500')).not.toBeNull()
  })

  it('renders no-budget empty state when utilization is null', () => {
    render(<BudgetSnapshotCard snapshot={noBudgetSnapshot} monthLabel="May 2026" />)
    expect(screen.getByText('No budget set.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Set one in Plan/ })
    expect(link).toHaveAttribute('href', '/plan')
  })
})
