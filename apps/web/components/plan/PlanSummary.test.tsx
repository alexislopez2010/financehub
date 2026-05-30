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
    plannedSavings: 0,
    actualSavings: 0,
    savingsDelta: 0,
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
    billsCommitted: 0,
    billsCoverage: 0,
    billsOverCommitted: false,
    ...over
  }
}

describe('<PlanSummaryTiles>', () => {
  it('renders all 5 tiles', () => {
    render(<PlanSummaryTiles metrics={metrics()} />)
    expect(screen.getByText('Spend vs Budget')).toBeInTheDocument()
    expect(screen.getByText('Income vs Plan')).toBeInTheDocument()
    expect(screen.getByText('Categories Over')).toBeInTheDocument()
    expect(screen.getByText('Categories Under')).toBeInTheDocument()
    expect(screen.getByText('Savings')).toBeInTheDocument()
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

  it('Savings tile: positive savings ahead of plan → emerald + positive tone', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({
          actualIncome: 8000,
          actualSpend: 5000,
          plannedIncome: 7500,
          budgeted: 5500,
          actualSavings: 3000,
          plannedSavings: 2000,
          savingsDelta: 1000
        })}
      />
    )
    expect(screen.getByText('+$3,000')).toBeInTheDocument()
    const cap = screen.getByText(/planned \$2,000 · ahead \$1,000/)
    expect(cap).toHaveClass('text-emerald-600')
  })

  it('Savings tile: negative savings → red icon + negative tone', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({
          actualIncome: 4000,
          actualSpend: 5500,
          plannedIncome: 7500,
          budgeted: 5000,
          actualSavings: -1500,
          plannedSavings: 2500,
          savingsDelta: -4000
        })}
      />
    )
    expect(screen.getByText('-$1,500')).toBeInTheDocument()
    const cap = screen.getByText(/planned \$2,500 · behind \$4,000/)
    expect(cap).toHaveClass('text-red-600')
  })

  it('Savings tile: positive but behind plan → neutral tone', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({
          actualIncome: 7000,
          actualSpend: 5500,
          plannedIncome: 7500,
          budgeted: 5000,
          actualSavings: 1500,
          plannedSavings: 2500,
          savingsDelta: -1000
        })}
      />
    )
    const cap = screen.getByText(/planned \$2,500 · behind \$1,000/)
    expect(cap).toHaveClass('text-gray-500')
  })

  it('Savings tile: plannedSavings <= 0 → "actual surplus" caption', () => {
    render(
      <PlanSummaryTiles
        metrics={metrics({
          actualIncome: 5000,
          actualSpend: 3000,
          plannedIncome: 5000,
          budgeted: 5000,
          actualSavings: 2000,
          plannedSavings: 0,
          savingsDelta: 2000
        })}
      />
    )
    expect(screen.getByText('+$2,000')).toBeInTheDocument()
    const cap = screen.getByText('actual surplus')
    expect(cap).toHaveClass('text-emerald-600')
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

  it('derives plannedSavings, actualSavings, savingsDelta', () => {
    const m = computePlanSummaryMetrics({
      budgetRows: [
        row({ budgeted: 1000, actual: 800, variance: 200 }),
        row({ budgeted: 500, actual: 600, variance: -100 })
      ],
      actualIncome: 4000,
      plannedIncome: 3500
    })
    // budgeted = 1500, actualSpend = 1400
    // plannedSavings = 3500 - 1500 = 2000
    // actualSavings  = 4000 - 1400 = 2600
    // savingsDelta   = 2600 - 2000 = 600
    expect(m.plannedSavings).toBe(2000)
    expect(m.actualSavings).toBe(2600)
    expect(m.savingsDelta).toBe(600)
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
