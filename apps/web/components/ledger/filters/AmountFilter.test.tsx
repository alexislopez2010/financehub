import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AmountFilter } from './AmountFilter'

describe('<AmountFilter>', () => {
  it('renders "Amount ▼" trigger when value is empty', () => {
    render(
      <AmountFilter
        value={{ minAmount: undefined, maxAmount: undefined }}
        onChange={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /filter by amount/i })).toBeInTheDocument()
  })

  it('renders set state with formatted min/max', () => {
    render(
      <AmountFilter
        value={{ minAmount: -500, maxAmount: 0 }}
        onChange={() => {}}
      />
    )
    const chip = screen.getByRole('button', { name: /edit amount range filter/i })
    expect(chip.textContent).toMatch(/-\$500/)
    expect(chip.textContent).toMatch(/\$0/)
  })

  it('renders only min when only min is set', () => {
    render(
      <AmountFilter
        value={{ minAmount: 100, maxAmount: undefined }}
        onChange={() => {}}
      />
    )
    const chip = screen.getByRole('button', { name: /edit amount range filter/i })
    expect(chip.textContent).toMatch(/≥/)
    expect(chip.textContent).toMatch(/\$100/)
  })

  it('clicking clear button clears the range', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AmountFilter
        value={{ minAmount: 100, maxAmount: undefined }}
        onChange={onChange}
      />
    )
    await user.click(screen.getByRole('button', { name: /clear amount filter/i }))
    expect(onChange).toHaveBeenCalledWith({ minAmount: undefined, maxAmount: undefined })
  })

  it('applying typed numbers calls onChange with parsed values', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AmountFilter
        value={{ minAmount: undefined, maxAmount: undefined }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /filter by amount/i }))
    const min = await screen.findByLabelText(/min/i)
    const max = await screen.findByLabelText(/max/i)
    await user.type(min, '-500')
    await user.type(max, '500')
    await user.click(screen.getByRole('button', { name: /^apply$/i }))

    expect(onChange).toHaveBeenCalledWith({ minAmount: -500, maxAmount: 500 })
  })

  it('quick range "Income only" fires onChange with minAmount=0', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <AmountFilter
        value={{ minAmount: undefined, maxAmount: undefined }}
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('button', { name: /filter by amount/i }))
    const quick = await screen.findByRole('button', { name: /income only/i })
    await user.click(quick)

    expect(onChange).toHaveBeenCalledWith({ minAmount: 0, maxAmount: undefined })
  })
})
