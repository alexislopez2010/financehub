import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TABS, isTabActive } from './tabs'

const mockUsePathname = vi.fn()
vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname()
}))

import { TabBar } from './TabBar'

beforeEach(() => {
  mockUsePathname.mockReset()
})

describe('isTabActive', () => {
  it('matches the root tab only on exact /', () => {
    const briefing = TABS.find(t => t.href === '/')!
    expect(isTabActive('/', briefing)).toBe(true)
    expect(isTabActive('/ledger', briefing)).toBe(false)
    expect(isTabActive('/anything', briefing)).toBe(false)
  })

  it('matches non-root tabs on exact path', () => {
    const ledger = TABS.find(t => t.href === '/ledger')!
    expect(isTabActive('/ledger', ledger)).toBe(true)
    expect(isTabActive('/plan', ledger)).toBe(false)
  })

  it('matches non-root tabs on nested subpaths', () => {
    const ledger = TABS.find(t => t.href === '/ledger')!
    expect(isTabActive('/ledger/123', ledger)).toBe(true)
    expect(isTabActive('/ledger/2025/05', ledger)).toBe(true)
  })

  it('does NOT match on a prefix collision (e.g. /led vs /ledger)', () => {
    const ledger = TABS.find(t => t.href === '/ledger')!
    expect(isTabActive('/ledgers', ledger)).toBe(false)  // /ledgers !== /ledger and doesn't start with /ledger/
    expect(isTabActive('/led', ledger)).toBe(false)
  })
})

describe('<TabBar variant="bottom">', () => {
  it('renders all 5 tabs', () => {
    mockUsePathname.mockReturnValue('/')
    render(<TabBar variant="bottom" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
    expect(screen.getByText('Briefing')).toBeInTheDocument()
    expect(screen.getByText('Ledger')).toBeInTheDocument()
    expect(screen.getByText('Plan')).toBeInTheDocument()
    expect(screen.getByText('Bills')).toBeInTheDocument()
    expect(screen.getByText('Accounts')).toBeInTheDocument()
  })

  it('marks the active tab with aria-current="page"', () => {
    mockUsePathname.mockReturnValue('/ledger')
    render(<TabBar variant="bottom" />)
    const active = screen.getByRole('link', { current: 'page' })
    expect(active).toHaveTextContent('Ledger')
  })

  it('marks Briefing active when pathname is /', () => {
    mockUsePathname.mockReturnValue('/')
    render(<TabBar variant="bottom" />)
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Briefing')
  })

  it('keeps the right tab active on a nested subpath', () => {
    mockUsePathname.mockReturnValue('/bills/some-id')
    render(<TabBar variant="bottom" />)
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Bills')
  })

  it('renders nav with aria-label="Primary"', () => {
    mockUsePathname.mockReturnValue('/')
    const { container } = render(<TabBar variant="bottom" />)
    expect(container.querySelector('nav[aria-label="Primary"]')).not.toBeNull()
  })
})

describe('<TabBar variant="inline">', () => {
  it('renders all 5 tabs', () => {
    mockUsePathname.mockReturnValue('/')
    render(<TabBar variant="inline" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('marks the active tab', () => {
    mockUsePathname.mockReturnValue('/accounts')
    render(<TabBar variant="inline" />)
    expect(screen.getByRole('link', { current: 'page' })).toHaveTextContent('Accounts')
  })
})
