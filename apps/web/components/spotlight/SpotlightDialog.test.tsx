import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from '@/lib/data/keys'
import type {
  TransactionRow,
  BillRow,
  AccountRow,
  CategoryRow
} from '@/lib/spotlight/search'

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

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
}

interface SeedData {
  transactions?: ReadonlyArray<TransactionRow>
  bills?: ReadonlyArray<BillRow>
  accounts?: ReadonlyArray<AccountRow>
  categories?: ReadonlyArray<CategoryRow>
}

function seedClient(client: QueryClient, seed: SeedData) {
  if (seed.transactions) client.setQueryData(queryKeys.transactions(), seed.transactions)
  if (seed.bills) client.setQueryData(queryKeys.bills(), seed.bills)
  if (seed.accounts) client.setQueryData(queryKeys.accounts(), seed.accounts)
  if (seed.categories) client.setQueryData(queryKeys.categories(), seed.categories)
}

function Shell({ children, client }: { children: ReactNode; client: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <SpotlightProvider>
        {children}
      </SpotlightProvider>
    </QueryClientProvider>
  )
}

function renderShell(seed: SeedData = {}) {
  const client = makeClient()
  seedClient(client, seed)
  return render(
    <Shell client={client}>
      <OpenButton />
      <SpotlightDialog />
    </Shell>
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

  it('does not render the Find group headings when the query is empty', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    await screen.findByPlaceholderText(/search or jump/i)
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument()
    expect(screen.queryByText('Bills', { selector: '[cmdk-group-heading]' })).not.toBeInTheDocument()
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

  it('renders live Find groups for cached corpus when typing', async () => {
    const user = userEvent.setup()
    const tx: TransactionRow = {
      id: 't1',
      description: 'Costco Wholesale',
      category: 'Groceries',
      category_id: null,
      account: 'Chase Checking',
      member: 'Alex',
      date: '2026-05-15',
      amount: -123.45,
      type: 'Expense'
    }
    const bill: BillRow = {
      id: 'b1',
      name: 'Costco Membership',
      category: 'Shopping',
      frequency: 'Yearly',
      due_day: 1,
      budget_amount: 60
    }
    renderShell({ transactions: [tx], bills: [bill] })
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    const input = await screen.findByPlaceholderText(/search or jump/i)
    await user.type(input, 'costco')
    expect(await screen.findByText('Costco Wholesale')).toBeInTheDocument()
    expect(screen.getByText('Costco Membership')).toBeInTheDocument()
  })

  it('navigates to a hit deep link on select', async () => {
    const user = userEvent.setup()
    const tx: TransactionRow = {
      id: 't1',
      description: 'Costco Wholesale',
      category: 'Groceries',
      category_id: null,
      account: 'Chase Checking',
      member: 'Alex',
      date: '2026-05-15',
      amount: -123.45,
      type: 'Expense'
    }
    renderShell({ transactions: [tx] })
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    const input = await screen.findByPlaceholderText(/search or jump/i)
    await user.type(input, 'costco')
    const hit = await screen.findByText('Costco Wholesale')
    await user.click(hit.closest('[cmdk-item]')!)
    expect(mockPush).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/ledger'))
  })

  it('renders no Find group headings when the query matches nothing', async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole('button', { name: /open spotlight/i }))
    const input = await screen.findByPlaceholderText(/search or jump/i)
    await user.type(input, 'zzzzznotamatch')
    // With no seeded corpus across all four kinds, every Find group renders nothing.
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument()
    expect(screen.queryByText('Bills', { selector: '[cmdk-group-heading]' })).not.toBeInTheDocument()
    expect(screen.queryByText('Accounts', { selector: '[cmdk-group-heading]' })).not.toBeInTheDocument()
    expect(screen.queryByText('Categories', { selector: '[cmdk-group-heading]' })).not.toBeInTheDocument()
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
