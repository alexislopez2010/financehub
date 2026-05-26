import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DescriptionSearch } from './DescriptionSearch'

describe('<DescriptionSearch>', () => {
  it('renders the search input with placeholder', () => {
    render(<DescriptionSearch value="" onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/search descriptions/i)).toBeInTheDocument()
  })

  it('shows current external value in the input', () => {
    render(<DescriptionSearch value="hello" onChange={() => {}} />)
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument()
  })

  it('debounces onChange after typing', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DescriptionSearch value="" onChange={onChange} />)

    const input = screen.getByPlaceholderText(/search descriptions/i)
    await user.type(input, 'star')

    // Debounce window is 200ms — wait for the call to land.
    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith('star')
      },
      { timeout: 1000 }
    )
  })

  it('clear button resets draft and calls onChange("")', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<DescriptionSearch value="star" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /clear search/i }))
    expect(onChange).toHaveBeenCalledWith('')
  })
})
