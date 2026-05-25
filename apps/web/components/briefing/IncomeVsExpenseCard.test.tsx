import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IncomeVsExpenseCard } from './IncomeVsExpenseCard'

describe('<IncomeVsExpenseCard>', () => {
  it('renders header + both rows + positive net', () => {
    render(<IncomeVsExpenseCard monthIncome={5000} monthExpense={3200} />)
    expect(screen.getByText('This Month')).toBeInTheDocument()
    expect(screen.getByText('Income vs Expense')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
    expect(screen.getByText('$3,200')).toBeInTheDocument()
    const net = screen.getByText('+$1,800')
    expect(net).toHaveClass('text-emerald-600')
  })

  it('renders negative net in red with minus sign', () => {
    render(<IncomeVsExpenseCard monthIncome={2000} monthExpense={3000} />)
    const net = screen.getByText('−$1,000')
    expect(net).toHaveClass('text-red-600')
  })

  it('renders empty state when both income and expense are zero', () => {
    render(<IncomeVsExpenseCard monthIncome={0} monthExpense={0} />)
    expect(
      screen.getByText('No income or expenses this month yet.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Income')).not.toBeInTheDocument()
  })
})
