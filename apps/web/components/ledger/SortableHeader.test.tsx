import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SortableHeader } from './SortableHeader'

describe('<SortableHeader>', () => {
  it('renders a button for every sortable column', () => {
    render(<SortableHeader sort={null} onSortChange={vi.fn()} showCheckboxColumn />)
    for (const label of ['Date', 'Description', 'Category', 'Account', 'Member', 'Amount']) {
      expect(screen.getByRole('button', { name: `Sort by ${label}` })).toBeInTheDocument()
    }
  })

  it('shows ▼ on the active desc column and marks it pressed', () => {
    render(
      <SortableHeader sort={{ key: 'amount', dir: 'desc' }} onSortChange={vi.fn()} showCheckboxColumn />
    )
    const amount = screen.getByRole('button', { name: 'Sort by Amount' })
    expect(within(amount).getByText('▼')).toBeInTheDocument()
    expect(amount).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows ▲ on the active asc column', () => {
    render(
      <SortableHeader sort={{ key: 'amount', dir: 'asc' }} onSortChange={vi.fn()} showCheckboxColumn />
    )
    expect(within(screen.getByRole('button', { name: 'Sort by Amount' })).getByText('▲')).toBeInTheDocument()
  })

  it('clicking an inactive column requests desc on that key', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(<SortableHeader sort={null} onSortChange={onSortChange} showCheckboxColumn />)
    await user.click(screen.getByRole('button', { name: 'Sort by Amount' }))
    expect(onSortChange).toHaveBeenCalledWith({ key: 'amount', dir: 'desc' })
  })

  it('clicking the active desc column flips to asc', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(
      <SortableHeader sort={{ key: 'amount', dir: 'desc' }} onSortChange={onSortChange} showCheckboxColumn />
    )
    await user.click(screen.getByRole('button', { name: 'Sort by Amount' }))
    expect(onSortChange).toHaveBeenCalledWith({ key: 'amount', dir: 'asc' })
  })

  it('clicking the active asc column clears the sort (back to grouping)', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(
      <SortableHeader sort={{ key: 'amount', dir: 'asc' }} onSortChange={onSortChange} showCheckboxColumn />
    )
    await user.click(screen.getByRole('button', { name: 'Sort by Amount' }))
    expect(onSortChange).toHaveBeenCalledWith(null)
  })

  it('switching to a different column always starts at desc', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(
      <SortableHeader sort={{ key: 'amount', dir: 'asc' }} onSortChange={onSortChange} showCheckboxColumn />
    )
    await user.click(screen.getByRole('button', { name: 'Sort by Date' }))
    expect(onSortChange).toHaveBeenCalledWith({ key: 'date', dir: 'desc' })
  })
})
