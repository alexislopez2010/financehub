import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), refresh: vi.fn() })
}))

import { SpotlightProvider, useSpotlight } from './SpotlightProvider'
import { SpotlightDialog } from './SpotlightDialog'

function OpenButton() {
  const { openSpotlight } = useSpotlight()
  return <button onClick={openSpotlight}>open spotlight</button>
}

function renderShell() {
  return render(
    <SpotlightProvider>
      <OpenButton />
      <SpotlightDialog />
    </SpotlightProvider>
  )
}

beforeEach(() => {
  mockPush.mockReset()
})

describe('<SpotlightDialog>', () => {
  it('is not mounted while closed', () => {
    renderShell()
    expect(screen.queryByPlaceholderText(/search or jump/i)).not.toBeInTheDocument()
  })

  it('renders the palette when opened', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    expect(await screen.findByPlaceholderText(/search or jump/i)).toBeInTheDocument()
  })

  it('renders all 5 surface jump entries + Admin', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    expect(await screen.findByText('Briefing')).toBeInTheDocument()
    expect(screen.getByText('Ledger')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Bills')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('renders the Find placeholder row', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    expect(await screen.findByText(/coming in phase 2k/i)).toBeInTheDocument()
  })

  it('navigates on selecting a Jump item', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    const ledger = await screen.findByText('Ledger')
    await user.click(ledger.closest('[cmdk-item]')!)
    expect(mockPush).toHaveBeenCalledWith('/ledger')
  })

  it('closes after a jump', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    const briefing = await screen.findByText('Briefing')
    await user.click(briefing.closest('[cmdk-item]')!)
    // After close the input is unmounted (Radix unmounts on close by default).
    expect(screen.queryByPlaceholderText(/search or jump/i)).not.toBeInTheDocument()
  })

  it('filters items by the search input', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    const input = await screen.findByPlaceholderText(/search or jump/i)
    await user.type(input, 'ledg')
    // Ledger still present; Briefing should be filtered out.
    expect(screen.getByText('Ledger')).toBeInTheDocument()
    expect(screen.queryByText('Briefing')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    await screen.findByPlaceholderText(/search or jump/i)
    await user.keyboard('{Escape}')
    expect(screen.queryByPlaceholderText(/search or jump/i)).not.toBeInTheDocument()
  })
})
