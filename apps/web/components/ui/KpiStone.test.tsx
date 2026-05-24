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
    expect(screen.getByText('+$620')).toBeInTheDocument()
  })

  it('applies the positive tone class on the caption', () => {
    render(<KpiStone label="Cash" value="$42,180" caption="+$620" tone="positive" />)
    expect(screen.getByText('+$620')).toHaveClass('text-accent')
  })

  it('applies the negative tone class on the caption', () => {
    render(<KpiStone label="Cash" value="$42,180" caption="-$300" tone="negative" />)
    expect(screen.getByText('-$300')).toHaveClass('text-warn')
  })

  it('value uses tabular figures', () => {
    render(<KpiStone label="Cash" value="$42,180" />)
    expect(screen.getByText('$42,180')).toHaveClass('tabular')
  })
})
