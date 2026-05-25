import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiStone } from './KpiStone'

describe('<KpiStone>', () => {
  it('renders label and value', () => {
    render(<KpiStone label="Cash" value="$42,180" />)
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('$42,180')).toBeInTheDocument()
  })

  it('omits caption when not provided', () => {
    const { container } = render(<KpiStone label="Cash" value="$42,180" />)
    expect(container.textContent).toBe('Cash$42,180')
  })

  it('renders caption when provided', () => {
    render(<KpiStone label="Cash" value="$42,180" caption="+$620" tone="positive" />)
    // Caption is two text nodes (glyph + value) — match by partial content
    expect(screen.getByText(/\+\$620/)).toBeInTheDocument()
  })

  it('applies the positive tone class on the caption + renders the up-arrow glyph', () => {
    render(<KpiStone label="Cash" value="$42,180" caption="+$620" tone="positive" />)
    const captionEl = screen.getByText(/\+\$620/)
    expect(captionEl).toHaveClass('text-accent')
    expect(captionEl.textContent).toContain('▲')
  })

  it('applies the negative tone class on the caption + renders the down-arrow glyph', () => {
    render(<KpiStone label="Cash" value="$42,180" caption="-$300" tone="negative" />)
    const captionEl = screen.getByText(/-\$300/)
    expect(captionEl).toHaveClass('text-warn')
    expect(captionEl.textContent).toContain('▼')
  })

  it('neutral tone caption has no arrow glyph', () => {
    render(<KpiStone label="Cash" value="$42,180" caption="net" tone="neutral" />)
    const captionEl = screen.getByText(/net/)
    expect(captionEl.textContent).not.toContain('▲')
    expect(captionEl.textContent).not.toContain('▼')
    expect(captionEl).toHaveClass('text-muted')
  })

  it('value uses tabular figures', () => {
    render(<KpiStone label="Cash" value="$42,180" />)
    expect(screen.getByText('$42,180')).toHaveClass('tabular')
  })
})
