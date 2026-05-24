import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RulerList, type RulerListItem } from './RulerList'

const items: ReadonlyArray<RulerListItem> = [
  { key: 'tucker', label: 'Tue 27  Tucker, mortgage', value: '$2,140.00' },
  { key: 'anthropic', label: 'Fri 30  Anthropic', value: '$200.00' },
  { key: 'fe', label: 'Mon 02  FirstEnergy', value: '$184.00' }
]

describe('<RulerList>', () => {
  it('renders one <li> per item', () => {
    render(<RulerList items={items} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('renders both label and value for each item', () => {
    render(<RulerList items={items} />)
    const lis = screen.getAllByRole('listitem')
    expect(within(lis[0]!).getByText(/Tucker/)).toBeInTheDocument()
    expect(within(lis[0]!).getByText('$2,140.00')).toBeInTheDocument()
  })

  it('values render with tabular figures', () => {
    render(<RulerList items={items} />)
    expect(screen.getByText('$2,140.00')).toHaveClass('tabular')
  })

  it('first n-1 items get a dotted border; last item does not', () => {
    render(<RulerList items={items} />)
    const lis = screen.getAllByRole('listitem')
    expect(lis[0]).toHaveClass('border-dotted')
    expect(lis[1]).toHaveClass('border-dotted')
    expect(lis[2]).not.toHaveClass('border-dotted')
  })

  it('renders an empty list when items is empty', () => {
    render(<RulerList items={[]} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
