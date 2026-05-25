import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from '@/lib/data/keys'
import { useSpotlightSearch } from './useSpotlightSearch'
import type {
  TransactionRow,
  BillRow,
  AccountRow,
  CategoryRow
} from './search'

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
}

function makeTx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    description: 'Costco Wholesale',
    category: 'Groceries',
    category_id: null,
    account: 'Chase Checking',
    member: 'Alex',
    date: '2026-05-15',
    amount: -123.45,
    type: 'Expense',
    ...over
  }
}

function makeBill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    name: 'Netflix',
    category: 'Subscriptions',
    frequency: 'Monthly',
    due_day: 7,
    budget_amount: 15.99,
    ...over
  }
}

function makeAccount(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'a1',
    name: 'Chase Checking',
    institution: 'Chase',
    account_type: 'checking',
    ...over
  }
}

function makeCategory(over: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'c1',
    name: 'Groceries',
    ...over
  }
}

describe('useSpotlightSearch', () => {
  it('returns empty + isEmpty=true for a blank query', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.transactions(), [makeTx()])

    const { result } = renderHook(() => useSpotlightSearch(''), { wrapper })

    expect(result.current.isEmpty).toBe(true)
    expect(result.current.hits).toEqual([])
    expect(result.current.groups.transactions).toEqual([])
    expect(result.current.groups.bills).toEqual([])
    expect(result.current.groups.accounts).toEqual([])
    expect(result.current.groups.categories).toEqual([])
  })

  it('treats whitespace-only query as blank', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.transactions(), [makeTx()])

    const { result } = renderHook(() => useSpotlightSearch('   \t  '), { wrapper })

    expect(result.current.isEmpty).toBe(true)
    expect(result.current.hits).toEqual([])
  })

  it('returns empty groups with isEmpty=true when cache is cold', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    const { result } = renderHook(() => useSpotlightSearch('costco'), { wrapper })

    expect(result.current.hits).toEqual([])
    expect(result.current.groups.transactions).toEqual([])
    expect(result.current.groups.bills).toEqual([])
    expect(result.current.groups.accounts).toEqual([])
    expect(result.current.groups.categories).toEqual([])
    expect(result.current.isEmpty).toBe(true)
  })

  it('produces transaction hits from cached transactions', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.transactions(), [
      makeTx({ id: 't1', description: 'Costco Wholesale' }),
      makeTx({ id: 't2', description: 'Trader Joes' })
    ])

    const { result } = renderHook(() => useSpotlightSearch('costco'), { wrapper })

    expect(result.current.isEmpty).toBe(false)
    expect(result.current.groups.transactions.length).toBeGreaterThan(0)
    expect(result.current.groups.transactions.every(h => h.kind === 'transaction')).toBe(true)
    expect(result.current.groups.transactions.some(h => h.id === 't1')).toBe(true)
    expect(result.current.groups.bills).toEqual([])
    expect(result.current.groups.accounts).toEqual([])
    expect(result.current.groups.categories).toEqual([])
  })

  it('produces bill hits from cached bills', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.bills(), [
      makeBill({ id: 'b1', name: 'Netflix' }),
      makeBill({ id: 'b2', name: 'Spotify' })
    ])

    const { result } = renderHook(() => useSpotlightSearch('netflix'), { wrapper })

    expect(result.current.isEmpty).toBe(false)
    expect(result.current.groups.bills.length).toBeGreaterThan(0)
    expect(result.current.groups.bills.every(h => h.kind === 'bill')).toBe(true)
    expect(result.current.groups.bills.some(h => h.id === 'b1')).toBe(true)
  })

  it('produces account hits from cached accounts', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.accounts(), [
      makeAccount({ id: 'a1', name: 'Chase Checking' }),
      makeAccount({ id: 'a2', name: 'Amex Gold' })
    ])

    const { result } = renderHook(() => useSpotlightSearch('amex'), { wrapper })

    expect(result.current.isEmpty).toBe(false)
    expect(result.current.groups.accounts.length).toBeGreaterThan(0)
    expect(result.current.groups.accounts.every(h => h.kind === 'account')).toBe(true)
    expect(result.current.groups.accounts.some(h => h.id === 'a2')).toBe(true)
  })

  it('produces category hits from cached categories', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.categories(), [
      makeCategory({ id: 'c1', name: 'Groceries' }),
      makeCategory({ id: 'c2', name: 'Restaurants' })
    ])

    const { result } = renderHook(() => useSpotlightSearch('restaurants'), { wrapper })

    expect(result.current.isEmpty).toBe(false)
    expect(result.current.groups.categories.length).toBeGreaterThan(0)
    expect(result.current.groups.categories.every(h => h.kind === 'category')).toBe(true)
    expect(result.current.groups.categories.some(h => h.id === 'c2')).toBe(true)
  })

  it('memoises the result across rerenders when inputs are unchanged', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.transactions(), [makeTx({ description: 'Costco' })])

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSpotlightSearch(q),
      { wrapper, initialProps: { q: 'costco' } }
    )

    const first = result.current
    rerender({ q: 'costco' })
    const second = result.current

    expect(second).toBe(first)
  })

  it('reactively picks up cache updates after initial render', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    const { result } = renderHook(() => useSpotlightSearch('costco'), { wrapper })
    expect(result.current.isEmpty).toBe(true)

    act(() => {
      client.setQueryData(queryKeys.transactions(), [
        makeTx({ id: 't1', description: 'Costco Wholesale' })
      ])
    })

    expect(result.current.isEmpty).toBe(false)
    expect(result.current.groups.transactions.some(h => h.id === 't1')).toBe(true)
  })

  it('reactively clears results when cache slot is removed', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.transactions(), [
      makeTx({ id: 't1', description: 'Costco Wholesale' })
    ])

    const { result } = renderHook(() => useSpotlightSearch('costco'), { wrapper })
    expect(result.current.isEmpty).toBe(false)
    expect(result.current.groups.transactions.some(h => h.id === 't1')).toBe(true)

    act(() => {
      client.removeQueries({ queryKey: queryKeys.transactions() })
    })

    expect(result.current.isEmpty).toBe(true)
    expect(result.current.groups.transactions).toEqual([])
    expect(result.current.groups.bills).toEqual([])
    expect(result.current.groups.accounts).toEqual([])
    expect(result.current.groups.categories).toEqual([])
  })

  it('maintains the consistency invariant: group sums equal hits length', () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    client.setQueryData(queryKeys.transactions(), [
      makeTx({ id: 't1', description: 'Match query token' })
    ])
    client.setQueryData(queryKeys.bills(), [
      makeBill({ id: 'b1', name: 'Match query bill' })
    ])
    client.setQueryData(queryKeys.accounts(), [
      makeAccount({ id: 'a1', name: 'Match query account' })
    ])
    client.setQueryData(queryKeys.categories(), [
      makeCategory({ id: 'c1', name: 'Match query category' })
    ])

    const { result } = renderHook(() => useSpotlightSearch('match'), { wrapper })

    const totalGroups =
      result.current.groups.transactions.length +
      result.current.groups.bills.length +
      result.current.groups.accounts.length +
      result.current.groups.categories.length

    expect(totalGroups).toBe(result.current.hits.length)
    expect(result.current.isEmpty).toBe(false)
  })
})
