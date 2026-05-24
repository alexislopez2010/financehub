import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpotlightProvider, useSpotlight } from './SpotlightProvider'

function Consumer() {
  const { open, openSpotlight, closeSpotlight, setOpen } = useSpotlight()
  return (
    <div>
      <div data-testid="state">{open ? 'open' : 'closed'}</div>
      <button onClick={openSpotlight}>open</button>
      <button onClick={closeSpotlight}>close</button>
      <button onClick={() => setOpen(true)}>setOpen-true</button>
    </div>
  )
}

describe('<SpotlightProvider>', () => {
  it('starts closed', () => {
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    expect(screen.getByTestId('state')).toHaveTextContent('closed')
  })

  it('openSpotlight() opens', async () => {
    const user = userEvent.setup()
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    await user.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByTestId('state')).toHaveTextContent('open')
  })

  it('closeSpotlight() closes', async () => {
    const user = userEvent.setup()
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    await user.click(screen.getByRole('button', { name: 'open' }))
    await user.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.getByTestId('state')).toHaveTextContent('closed')
  })

  it('Cmd-K toggles open', async () => {
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    expect(screen.getByTestId('state')).toHaveTextContent('closed')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    })
    expect(screen.getByTestId('state')).toHaveTextContent('open')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
    })
    expect(screen.getByTestId('state')).toHaveTextContent('closed')
  })

  it('Ctrl-K toggles open', async () => {
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })
    expect(screen.getByTestId('state')).toHaveTextContent('open')
  })

  it('plain "k" does NOT toggle', () => {
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }))
    })
    expect(screen.getByTestId('state')).toHaveTextContent('closed')
  })

  it('Shift-Cmd-K does NOT toggle', () => {
    render(
      <SpotlightProvider>
        <Consumer />
      </SpotlightProvider>
    )
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, shiftKey: true }))
    })
    expect(screen.getByTestId('state')).toHaveTextContent('closed')
  })

  it('useSpotlight throws outside a provider', () => {
    // Suppress React's expected error log during this assertion
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() => render(<Consumer />)).toThrow(/must be used inside/)
    } finally {
      spy.mockRestore()
    }
  })
})
