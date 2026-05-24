import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Standfirst } from './Standfirst'

describe('<Standfirst>', () => {
  it('renders children inside a <p>', () => {
    render(<Standfirst>A quiet month. Groceries down 18%.</Standfirst>)
    const p = screen.getByText('A quiet month. Groceries down 18%.')
    expect(p.tagName).toBe('P')
  })
})
