import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Headline } from './Headline'

describe('<Headline>', () => {
  it('renders children as an h1 by default', () => {
    render(<Headline>Net worth, up 2.4% this month.</Headline>)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent('Net worth, up 2.4% this month.')
  })

  it('respects the as prop', () => {
    render(<Headline as="h2">Sub</Headline>)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Sub')
  })
})
