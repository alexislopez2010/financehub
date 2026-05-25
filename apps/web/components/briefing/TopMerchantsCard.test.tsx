import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MerchantSpendRow } from '@/lib/briefing/topMerchants'
import { TopMerchantsCard } from './TopMerchantsCard'

const rows: ReadonlyArray<MerchantSpendRow> = [
  { merchant: 'TARGET', amount: 540, count: 4 },
  { merchant: 'WHOLE FOODS', amount: 320, count: 2 },
  { merchant: 'AMAZON', amount: 210, count: 5 }
]

describe('<TopMerchantsCard>', () => {
  it('renders header and merchant rows with amounts + counts', () => {
    render(<TopMerchantsCard rows={rows} />)
    expect(screen.getByText('Top Merchants')).toBeInTheDocument()
    expect(screen.getByText('This month')).toBeInTheDocument()
    expect(screen.getByText('TARGET')).toBeInTheDocument()
    expect(screen.getByText('$540')).toBeInTheDocument()
    expect(screen.getByText('(4 tx)')).toBeInTheDocument()
    expect(screen.getByText('AMAZON')).toBeInTheDocument()
    expect(screen.getByText('(5 tx)')).toBeInTheDocument()
  })

  it('renders empty state when rows is empty', () => {
    render(<TopMerchantsCard rows={[]} />)
    expect(
      screen.getByText('No merchant spend this month yet.')
    ).toBeInTheDocument()
  })

  it('truncates very long merchant names', () => {
    const longRow: MerchantSpendRow = {
      merchant: 'A'.repeat(60),
      amount: 100,
      count: 1
    }
    render(<TopMerchantsCard rows={[longRow]} />)
    // truncate threshold = 28 → 27 chars + ellipsis
    expect(screen.getByText('A'.repeat(27) + '…')).toBeInTheDocument()
  })
})
