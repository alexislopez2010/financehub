import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TrendingUp } from 'lucide-react'
import { KpiTile } from './KpiTile'

describe('<KpiTile>', () => {
  it('renders label and value', () => {
    render(<KpiTile label="Cash" value="$42,180" />)
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('$42,180')).toBeInTheDocument()
  })

  it('value uses tabular figures + bold weight', () => {
    render(<KpiTile label="Cash" value="$42,180" />)
    const v = screen.getByText('$42,180')
    expect(v).toHaveClass('tabular')
    expect(v).toHaveClass('font-bold')
  })

  it('omits caption when not provided', () => {
    const { container } = render(<KpiTile label="Cash" value="$42,180" />)
    expect(container.textContent).toBe('Cash$42,180')
  })

  it('renders positive caption with up arrow + emerald color', () => {
    render(<KpiTile label="Cash" value="$42,180" caption="+$620" captionTone="positive" />)
    const cap = screen.getByText(/\+\$620/)
    expect(cap.textContent).toContain('↗')
    expect(cap).toHaveClass('text-emerald-600')
  })

  it('renders negative caption with down arrow + red color', () => {
    render(<KpiTile label="Cash" value="$42,180" caption="-$300" captionTone="negative" />)
    const cap = screen.getByText(/-\$300/)
    expect(cap.textContent).toContain('↘')
    expect(cap).toHaveClass('text-red-600')
  })

  it('neutral caption has no arrow + gray color', () => {
    render(<KpiTile label="Cash" value="$42,180" caption="steady" captionTone="neutral" />)
    const cap = screen.getByText(/steady/)
    expect(cap.textContent).not.toContain('↗')
    expect(cap.textContent).not.toContain('↘')
    expect(cap).toHaveClass('text-gray-500')
  })

  it('omits icon when not provided', () => {
    const { container } = render(<KpiTile label="X" value="Y" />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('renders icon in tone-colored pill', () => {
    const { container } = render(
      <KpiTile label="X" value="Y" icon={TrendingUp} iconTone="emerald" />
    )
    const pill = container.querySelector('div.bg-emerald-50')
    expect(pill).not.toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
