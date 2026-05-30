import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  PlanSummaryTiles,
  computePlanSummaryMetrics,
  type PlanSummaryMetrics
} from './PlanSummary'
import type { BudgetVsActualRow } from '@/lib/plan/budgetVsActual'

function metrics(over: Partial<PlanSummaryMetrics> = {}): PlanSummaryMetrics {
  return {
    actualSpend: 0,
    budgeted: 0,
    actualIncome: 0,
    plannedIncome: 0,
    overCount: 0,
    underCount: 0,
    totalOverage: 0,
    totalRemaining: 0,
    ...over
  }
}

function row(over: Partial<BudgetVsActualRow> = {}): BudgetVsActualRow {
  return {
    budgetId: 'b1',
    category: 'Cat',
    categoryId: null,
    budgeted: 100,
    actual: 0,
    variance: 100,
    ...over
  }
}

describe('<PlanSummaryTiles>', () => {
  it('renders all 4 tiles', () => {
    render(<PlanSummaryTiles metrics={metrics()} />)
    expect(screen.getByText('Spend vs Budget')).toBeInTheDocument()
    expect(screen.getByText('Income vs Plan')).toBeInTheDocument()
    expect(screen.getByText('Categories Over')).toBeInTheDocument()
    expect(screen.getByText('Categories Under')).toBeInTheDocument()
  })

  it('over-spending → Spend tile tone is negative and caption says "over"', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({ actualSpend: 22677, budgeted: 8174 })}
      />
    )
    // $22,677 − $8,174 = $14,503 over.
    const cap = screen.getByText(/\$14,503 over/)
    expect(cap).toHaveClass('text-red-600')
  })

  it('under-spending → Spend tile tone is positive with "of $X budgeted"', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({ actualSpend: 1500, budgeted: 3000 })}
      />
    )
    const cap = screen.getByText(/of \$3,000 budgeted/)
    expect(cap).toHaveClass('text-emerald-600')
  })

  it('income ahead of plan → Income tile tone positive + "+ahead" caption', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({ actualIncome: 6000, plannedIncome: 5000 })}
      />
    )
    const cap = screen.getByText(/ahead/)
    expect(cap).toHaveClass('text-emerald-600')
    expect(cap.textContent).toContain('+$1,000')
  })

  it('income behind plan → Income tile tone negative + "of $X planned"', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({ actualIncome: 3000, plannedIncome: 5000 })}
      />
    )
    const cap = screen.getByText(/of \$5,000 planned/)
    expect(cap).toHaveClass('text-red-600')
  })

  it('0 categories over → "none over budget" with positive tone', () => {
    render(<PlanSummaryTiles metrics={metrics({ overCount: 0 })} />)
    const cap = screen.getByText('none over budget')
    expect(cap).toHaveClass('text-emerald-600')
  })

  it('0 categories under → "none with budget left" with neutral tone', () => {
    render(<PlanSummaryTiles metrics={metrics({ underCount: 0 })} />)
    const cap = screen.getByText('none with budget left')
    expect(cap).toHaveClass('text-gray-500')
  })

  it('counts render as the tile value', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({
          overCount: 5,
          underCount: 8,
          totalOverage: 250,
          totalRemaining: 1200
        })}
      />
    )
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText(/over by \$250/)).toBeInTheDocument()
    expect(screen.getByText(/\$1,200 remaining/)).toBeInTheDocument()
  })
})

describe('computePlanSummaryMetrics', () => {
  it('sums spend + budget across rows', () => {
    const m = computePlanSummaryMetrics({
      budgetRows: [
        row({ budgeted: 100, actual: 50, variance: 50 }),
        row({ budgeted: 200, actual: 75, variance: 125 })
      ],
      actualIncome: 0,
      plannedIncome: 0
    })
    expect(m.budgeted).toBe(300)
    expect(m.actualSpend).toBe(125)
  })

  it('classifies over/under and sums overage/remaining', () => {
    const m = computePlanSummaryMetrics({
      budgetRows: [
        row({ budgeted: 100, actual: 150, variance: -50 }), // over by 50
        row({ budgeted: 200, actual: 250, variance: -50 }), // over by 50
        row({ budgeted: 300, actual: 100, variance: 200 }), // under 200
        row({ budgeted: 0, actual: 80, variance: -80 })     // actuals-only, excluded
      ],
      actualIncome: 0,
      plannedIncome: 0
    })
    expect(m.overCount).toBe(2)
    expect(m.underCount).toBe(1)
    expect(m.totalOverage).toBe(100)
    expect(m.totalRemaining).toBe(200)
  })
})
