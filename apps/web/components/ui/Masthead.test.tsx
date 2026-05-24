import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Masthead } from './Masthead'

describe('<Masthead>', () => {
  it('renders volume and date strings', () => {
    render(<Masthead volume="VOL. III · BRIEFING" date="SAT, MAY 23" />)
    expect(screen.getByText('VOL. III · BRIEFING')).toBeInTheDocument()
    expect(screen.getByText('SAT, MAY 23')).toBeInTheDocument()
  })

  it('renders inside a <header> element', () => {
    const { container } = render(<Masthead volume="V" date="D" />)
    expect(container.querySelector('header')).not.toBeNull()
  })

  it('accepts and merges a className prop', () => {
    const { container } = render(<Masthead volume="V" date="D" className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
