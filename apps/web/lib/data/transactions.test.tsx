import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

type TransactionRow = Tables<'transactions'>

// Hoisted Supabase mock — must come before SUT import.
const mockInsertSingle = vi.fn()
const mockUpdateSingle = vi.fn()
const mockDeleteEq = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      insert: (_payload: unknown) => ({
        select: () => ({
          single: () => mockInsertSingle()
        })
      }),
      update: (_patch: unknown) => ({
        eq: (_col: string, _val: unknown) => ({
          select: () => ({
            single: () => mockUpdateSingle()
          })
        })
      }),
      delete: () => ({
        eq: (_col: string, _val: unknown) => mockDeleteEq()
      })
    })
  })
}))

import { useCreateTransaction, useUpdateTransaction, useDeleteTransaction } from './transactions'

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

function seedCache(client: QueryClient, rows: ReadonlyArray<TransactionRow>): void {
  client.setQueryData(queryKeys.transactions(), rows)
}

function makeTx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: 'h1',
    date: '2025-05-15',
    description: 'Test',
    amount: 100,
    type: 'Expense',
    category: null,
    category_id: null,
    account: null,
    account_id: null,
    created_at: null,
    fingerprint: null,
    imported_at: null,
    member: null,
    notes: null,
    payment_method: null,
    sub_category: null,
    transfer_group_id: null,
    transfer_pair_id: null,
    ...over
  }
}

beforeEach(() => {
  mockInsertSingle.mockReset()
  mockUpdateSingle.mockReset()
  mockDeleteEq.mockReset()
})

describe('useCreateTransaction', () => {
  it('optimistically prepends the new tx to the cache before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeTx({ id: 'existing' })])

    // Stall the server response so we can observe the optimistic state.
    let resolveServer: (v: { data: TransactionRow; error: null }) => void = () => {}
    mockInsertSingle.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useCreateTransaction(), { wrapper })

    const payload = {
      household_id: 'h1', date: '2025-05-20', description: 'New', amount: 50, type: 'Expense'
    }
    void result.current.mutate(payload as Parameters<typeof result.current.mutate>[0])

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
      expect(cache).toBeDefined()
      expect(cache).toHaveLength(2)
      expect(cache![0]!.id).toMatch(/^tmp-/)
      expect(cache![0]!.description).toBe('New')
      expect(cache![1]!.id).toBe('existing')
    })

    // Let the server respond and the cache invalidate.
    resolveServer({ data: makeTx({ id: 'server-t', description: 'New', amount: 50 }), error: null })
  })

  it('rolls back optimistic insert on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeTx({ id: 'a' })]
    seedCache(client, initial)

    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })

    const { result } = renderHook(() => useCreateTransaction(), { wrapper })

    await new Promise<void>(resolve => {
      result.current.mutate(
        {
          household_id: 'h1', date: '2025-05-20', description: 'X', amount: 1, type: 'Expense'
        } as Parameters<typeof result.current.mutate>[0],
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    expect(cache).toEqual(initial)
  })
})

describe('useUpdateTransaction', () => {
  it('optimistically applies the patch before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeTx({ id: 't1', description: 'old', amount: 100 })])

    let resolveServer: (v: { data: TransactionRow; error: null }) => void = () => {}
    mockUpdateSingle.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useUpdateTransaction(), { wrapper })
    void result.current.mutate({ id: 't1', patch: { description: 'new', amount: 200 } })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
      expect(cache?.[0]!.description).toBe('new')
      expect(cache?.[0]!.amount).toBe(200)
    })

    resolveServer({ data: makeTx({ id: 't1', description: 'new', amount: 200 }), error: null })
  })

  it('rolls back optimistic patch on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeTx({ id: 't1', description: 'old', amount: 100 })]
    seedCache(client, initial)

    mockUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } })

    const { result } = renderHook(() => useUpdateTransaction(), { wrapper })

    await new Promise<void>(resolve => {
      result.current.mutate(
        { id: 't1', patch: { description: 'new' } },
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    expect(cache?.[0]!.description).toBe('old')
  })
})

describe('useDeleteTransaction', () => {
  it('optimistically removes the row before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeTx({ id: 'a' }), makeTx({ id: 'b' })])

    let resolveServer: (v: { error: null }) => void = () => {}
    mockDeleteEq.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useDeleteTransaction(), { wrapper })
    void result.current.mutate('a')

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
      expect(cache?.map(t => t.id)).toEqual(['b'])
    })

    resolveServer({ error: null })
  })

  it('rolls back on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeTx({ id: 'a' }), makeTx({ id: 'b' })]
    seedCache(client, initial)

    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'delete failed' } })

    const { result } = renderHook(() => useDeleteTransaction(), { wrapper })

    await new Promise<void>(resolve => {
      result.current.mutate('a', { onSettled: () => resolve() })
    })

    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    expect(cache).toEqual(initial)
  })
})
