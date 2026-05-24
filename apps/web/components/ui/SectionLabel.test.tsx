import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionLabel } from './SectionLabel'

describe('<SectionLabel>', () => {
  it('renders children', () => {
    render(<SectionLabel>Coming Due — 14 days</SectionLabel>)
    expect(screen.getByText('Coming Due — 14 days')).toBeInTheDocument()
  })
})
