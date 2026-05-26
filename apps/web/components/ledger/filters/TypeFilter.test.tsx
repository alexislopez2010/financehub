import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TypeFilter } from './TypeFilter'

describe('<TypeFilter>', () => {
  it('renders "Type ▼" trigger when value is undefined', () => {
    render(<TypeFilter value={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /filter by type/i })).toBeInTheDocument()
  })

  it('renders set state with value + clear button', () => {
    render(<TypeFilter value="Expense" onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear type filter \(expense\)/i })
    expect(chip.textContent).toMatch(/Expense/)
  })

  it('clicking clear chip calls onChange(undefined)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TypeFilter value="Expense" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /clear type filter/i }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('picking a type fires onChange with the type', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<TypeFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by type/i }))
    const item = await screen.findByRole('menuitem', { name: 'Transfer' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith('Transfer')
  })
})
