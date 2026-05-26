import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DateRangeFilter } from './DateRangeFilter'

describe('<DateRangeFilter>', () => {
  it('renders "Date ▼" trigger when value is empty', () => {
    render(
      <DateRangeFilter
        value={{ startDate: undefined, endDate: undefined }}
        onChange={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /filter by date/i })).toBeInTheDocument()
  })

  it('renders set state with formatted range', () => {
    render(
      <DateRangeFilter
        value={{ startDate: '2025-05-01', endDate: '2025-05-24' }}
        onChange={() => {}}
      />
    )
    const chip = screen.getByRole('button', { name: /edit date range filter/i })
    expect(chip.textContent).toMatch(/5\/1 – 5\/24/)
  })

  it('clicking clear button clears the range', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DateRangeFilter
        value={{ startDate: '2025-05-01', endDate: '2025-05-24' }}
        onChange={onChange}
      />
    )
    await user.click(screen.getByRole('button', { name: /clear date filter/i }))
    expect(onChange).toHaveBeenCalledWith({ startDate: undefined, endDate: undefined })
  })

  it('applying typed dates calls onChange with both', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <DateRangeFilter
        value={{ startDate: undefined, endDate: undefined }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /filter by date/i }))
    const from = await screen.findByLabelText(/from/i)
    const to = await screen.findByLabelText(/to/i)
    await user.type(from, '2025-05-01')
    await user.type(to, '2025-05-24')
    await user.click(screen.getByRole('button', { name: /^apply$/i }))

    expect(onChange).toHaveBeenCalledWith({ startDate: '2025-05-01', endDate: '2025-05-24' })
  })
})
