import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { LedgerFilters } from '@/lib/ledger/filters'

vi.mock('@/lib/data/accounts', () => ({
  useAccounts: () => ({ data: [] })
}))
vi.mock('@/lib/data/categories', () => ({
  useCategories: () => ({ data: [] })
}))
vi.mock('@/lib/data/householdMembers', () => ({
  useHouseholdMembersList: () => ({ data: [] })
}))

import { FilterSheet } from './FilterSheet'

/**
 * Stateful host that mirrors the real wiring: parent owns filters,
 * onChange propagates to state, sheet re-renders with the new value.
 * Required because the inputs are controlled — without this, the DOM
 * resets after each keystroke.
 */
function StatefulHost({
  initial = {} as LedgerFilters,
  onSpy
}: {
  initial?: LedgerFilters
  onSpy: (f: LedgerFilters) => void
}) {
  const [filters, setFilters] = useState<LedgerFilters>(initial)
  return (
    <FilterSheet
      open
      onOpenChange={() => {}}
      filters={filters}
      onChange={(next) => {
        setFilters(next)
        onSpy(next)
      }}
    />
  )
}

describe('<FilterSheet>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Amount Min and Max inputs', () => {
    const onSpy = vi.fn()
    render(<StatefulHost onSpy={onSpy} />)
    expect(screen.getByLabelText(/minimum amount/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/maximum amount/i)).toBeInTheDocument()
  })

  it('typing into Min eventually propagates minAmount=100', async () => {
    const user = userEvent.setup()
    const onSpy = vi.fn()
    render(<StatefulHost onSpy={onSpy} />)

    const min = screen.getByLabelText(/minimum amount/i)
    await user.type(min, '100')

    const last = onSpy.mock.calls.at(-1)?.[0] as LedgerFilters | undefined
    expect(last?.minAmount).toBe(100)
  })

  it('typing 100 in Min and 500 in Max yields the expected range', async () => {
    const user = userEvent.setup()
    const onSpy = vi.fn()
    render(<StatefulHost onSpy={onSpy} />)

    await user.type(screen.getByLabelText(/minimum amount/i), '100')
    await user.type(screen.getByLabelText(/maximum amount/i), '500')

    const last = onSpy.mock.calls.at(-1)?.[0] as LedgerFilters | undefined
    expect(last?.minAmount).toBe(100)
    expect(last?.maxAmount).toBe(500)
  })

  it('clearing Min input drops minAmount from filters (treated as undefined, not 0)', async () => {
    const user = userEvent.setup()
    const onSpy = vi.fn()
    render(<StatefulHost initial={{ minAmount: 100 }} onSpy={onSpy} />)

    const min = screen.getByLabelText(/minimum amount/i) as HTMLInputElement
    expect(min.value).toBe('100')
    await user.clear(min)

    const last = onSpy.mock.calls.at(-1)?.[0] as LedgerFilters | undefined
    expect(last).toBeDefined()
    expect(last && 'minAmount' in last).toBe(false)
  })

  it('renders existing minAmount/maxAmount values from filters', () => {
    const onSpy = vi.fn()
    render(<StatefulHost initial={{ minAmount: -500, maxAmount: 0 }} onSpy={onSpy} />)
    const min = screen.getByLabelText(/minimum amount/i) as HTMLInputElement
    const max = screen.getByLabelText(/maximum amount/i) as HTMLInputElement
    expect(min.value).toBe('-500')
    expect(max.value).toBe('0')
  })
})
