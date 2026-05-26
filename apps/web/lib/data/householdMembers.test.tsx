import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Hoisted Supabase mock — must come before SUT import.
// `useHouseholdMembersList` chains: from(t).select(cols).eq(c, v).order(c, opts)
// The terminal `.order(...)` returns the { data, error } envelope.
const mockOrder = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          order: (col: string, opts: unknown) => mockOrder(col, opts)
        })
      })
    })
  })
}))

import { useHouseholdMembersList } from './householdMembers'

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

beforeEach(() => {
  mockOrder.mockReset()
})

describe('useHouseholdMembersList', () => {
  it('returns rows ordered by display_name', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockOrder.mockResolvedValueOnce({
      data: [
        { user_id: 'u1', display_name: 'Alexis Lopez', role: 'owner' },
        { user_id: 'u2', display_name: 'Marilyn Lopez', role: 'member' }
      ],
      error: null
    })

    const { result } = renderHook(() => useHouseholdMembersList(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockOrder).toHaveBeenCalledWith('display_name', { ascending: true })
    expect(result.current.data).toEqual([
      { user_id: 'u1', display_name: 'Alexis Lopez', role: 'owner' },
      { user_id: 'u2', display_name: 'Marilyn Lopez', role: 'member' }
    ])
  })

  it('surfaces SELECT errors', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { message: 'rls denied' }
    })

    const { result } = renderHook(() => useHouseholdMembersList(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('rls denied')
  })

  it('returns an empty array when there are no rows', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockOrder.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useHouseholdMembersList(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})
