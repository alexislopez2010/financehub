import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpotlightProvider, useSpotlight } from './SpotlightProvider'
import { SpotlightBar } from './SpotlightBar'

function Probe() {
  const { open } = useSpotlight()
  return <div data-testid="probe">{open ? 'open' : 'closed'}</div>
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<SpotlightProvider>{ui}</SpotlightProvider>)
}

describe('<SpotlightBar>', () => {
  it('renders a button with the default placeholder', () => {
    renderWithProvider(<SpotlightBar />)
    expect(screen.getByRole('button', { name: /search or jump/i })).toBeInTheDocument()
  })

  it('renders a custom placeholder', () => {
    renderWithProvider(<SpotlightBar placeholder="Find anything" />)
    expect(screen.getByRole('button', { name: /find anything/i })).toBeInTheDocument()
  })

  it('opens the spotlight on click', async () => {
    renderWithProvider(
      <>
        <SpotlightBar />
        <Probe />
      </>
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('closed')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button'))
    expect(screen.getByTestId('probe')).toHaveTextContent('open')
  })

  it('throws if rendered without a SpotlightProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<SpotlightBar />)).toThrow(/must be used inside/)
    } finally {
      spy.mockRestore()
    }
  })
})
