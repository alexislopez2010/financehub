import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LedgerFooter, deriveTotals } from './LedgerFooter'
import type { Tables } from '@/lib/supabase/database.types'

type TxRow = Tables<'transactions'>

function tx(over: Partial<TxRow> = {}): TxRow {
  return {
    id: 't1', household_id: 'h', date: '2025-05-15', description: '',
    amount: 100, type: 'Expense',
    category: null, category_id: null, account: null, account_id: null,
    created_at: null, fingerprint: null, imported_at: null, member: null,
    notes: null, payment_method: null, sub_category: null,
    transfer_group_id: null, transfer_pair_id: null, exclude_from_runway: false, ...over
  }
}

describe('deriveTotals', () => {
  it('returns all zeros for empty input', () => {
    expect(deriveTotals([])).toEqual({ count: 0, income: 0, expense: 0, transfers: 0, net: 0 })
  })

  it('sums Income + Refund as income; Expense as expense', () => {
    const t = deriveTotals([
      tx({ amount: 500, type: 'Income' }),
      tx({ amount: 100, type: 'Refund' }),
      tx({ amount: 250, type: 'Expense' })
    ])
    expect(t.income).toBe(600)
    expect(t.expense).toBe(250)
    expect(t.net).toBe(350)
  })

  it('excludes Transfer from income/expense/net but sums into transfers', () => {
    const t = deriveTotals([
      tx({ amount: 500, type: 'Income' }),
      tx({ amount: 500, type: 'Transfer' })
    ])
    expect(t.income).toBe(500)
    expect(t.expense).toBe(0)
    expect(t.net).toBe(500)
    expect(t.transfers).toBe(500)
  })

  it('sums multiple Transfer rows into transfers as absolute amounts', () => {
    const t = deriveTotals([
      tx({ id: 't1', amount: 400, type: 'Transfer' }),
      tx({ id: 't2', amount: -400, type: 'Transfer' }),
      tx({ id: 't3', amount: 150, type: 'Transfer' })
    ])
    expect(t.transfers).toBe(950)
    expect(t.income).toBe(0)
    expect(t.expense).toBe(0)
    expect(t.net).toBe(0)
  })

  it('reports transfers as 0 when no Transfer rows are present', () => {
    const t = deriveTotals([
      tx({ amount: 100, type: 'Expense' }),
      tx({ amount: 200, type: 'Income' })
    ])
    expect(t.transfers).toBe(0)
  })

  it('uses absolute values', () => {
    const t = deriveTotals([
      tx({ amount: -300, type: 'Expense' }),
      tx({ amount: -100, type: 'Income' })
    ])
    expect(t.expense).toBe(300)
    expect(t.income).toBe(100)
  })

  it('counts every transaction (including Transfers)', () => {
    const t = deriveTotals([
      tx({ id: 'a' }), tx({ id: 'b', type: 'Transfer' }), tx({ id: 'c', type: 'Refund' })
    ])
    expect(t.count).toBe(3)
  })
})

describe('<LedgerFooter>', () => {
  it('renders the count', () => {
    render(<LedgerFooter transactions={[tx(), tx({ id: 't2' })]} />)
    expect(screen.getAllByText(/2/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/transactions/)).toBeInTheDocument()
  })

  it('renders all three totals (in/out/net)', () => {
    render(<LedgerFooter transactions={[
      tx({ id: 'a', amount: 500, type: 'Income' }),
      tx({ id: 'b', amount: 200, type: 'Expense' })
    ]} />)
    expect(screen.getByText('in')).toBeInTheDocument()
    expect(screen.getByText('out')).toBeInTheDocument()
    expect(screen.getByText('net')).toBeInTheDocument()
  })

  it('tones the net positive in emerald', () => {
    render(<LedgerFooter transactions={[tx({ amount: 500, type: 'Income' })]} />)
    expect(screen.getAllByText(/\$500/).length).toBeGreaterThanOrEqual(1)
    // Find the net span specifically
    const netLabel = screen.getByText('net')
    const netValue = netLabel.nextElementSibling
    expect(netValue?.className).toContain('text-emerald-600')
  })

  it('tones the net negative in red', () => {
    render(<LedgerFooter transactions={[tx({ amount: 500, type: 'Expense' })]} />)
    const netLabel = screen.getByText('net')
    const netValue = netLabel.nextElementSibling
    expect(netValue?.className).toContain('text-red-600')
  })

  it('renders the transfers pill when transfers > 0', () => {
    render(<LedgerFooter transactions={[
      tx({ id: 'a', amount: 500, type: 'Income' }),
      tx({ id: 'b', amount: 400, type: 'Transfer' })
    ]} />)
    expect(screen.getByText('transfers')).toBeInTheDocument()
    const transfersLabel = screen.getByText('transfers')
    const transfersValue = transfersLabel.nextElementSibling
    expect(transfersValue?.className).toContain('text-muted')
  })

  it('hides the transfers pill when transfers === 0', () => {
    render(<LedgerFooter transactions={[
      tx({ id: 'a', amount: 500, type: 'Income' }),
      tx({ id: 'b', amount: 200, type: 'Expense' })
    ]} />)
    expect(screen.queryByText('transfers')).toBeNull()
  })

  it('singular vs plural', () => {
    const { rerender } = render(<LedgerFooter transactions={[tx()]} />)
    expect(screen.getByText(/transaction\b/)).toBeInTheDocument()
    expect(screen.queryByText(/transactions/)).toBeNull()
    rerender(<LedgerFooter transactions={[tx(), tx({ id: 't2' })]} />)
    expect(screen.getByText(/transactions/)).toBeInTheDocument()
  })
})
