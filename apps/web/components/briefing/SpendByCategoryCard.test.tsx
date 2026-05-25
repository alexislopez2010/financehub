import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CategorySpendRow } from '@/lib/briefing/spendByCategory'
import { SpendByCategoryCard } from './SpendByCategoryCard'

const rows: ReadonlyArray<CategorySpendRow> = [
  {
    category: 'Groceries',
    amount: 425,
    priorAmount: 380,
    monthOverMonth: 0.1184,
    shareOfTotal: 0.5
  },
  {
    category: 'Dining',
    amount: 200,
    priorAmount: 250,
    monthOverMonth: -0.2,
    shareOfTotal: 0.25
  },
  {
    category: 'Fuel',
    amount: 200,
    priorAmount: 0,
    monthOverMonth: null,
    shareOfTotal: 0.25
  }
]

describe('<SpendByCategoryCard>', () => {
  it('renders header + rows with amounts', () => {
    render(<SpendByCategoryCard rows={rows} />)
    expect(screen.getByText('Spend by Category')).toBeInTheDocument()
    expect(screen.getByText('This month')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('$425')).toBeInTheDocument()
  })

  it('renders MoM arrows with correct tone', () => {
    render(<SpendByCategoryCard rows={rows} />)
    // Positive MoM (spend up) → red ▲
    const up = screen.getByText('▲ 12%')
    expect(up).toHaveClass('text-red-600')
    // Negative MoM (spend down) → emerald ▼
    const down = screen.getByText('▼ 20%')
    expect(down).toHaveClass('text-emerald-600')
    // Null MoM → muted dash
    const dash = screen.getByText('—')
    expect(dash).toHaveClass('text-muted')
  })

  it('renders empty state when rows is empty', () => {
    render(<SpendByCategoryCard rows={[]} />)
    expect(
      screen.getByText('No expense transactions this month yet.')
    ).toBeInTheDocument()
  })
})
