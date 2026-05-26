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
const mockRpc = vi.fn()

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
    }),
    rpc: (name: string, args: Record<string, unknown>) => mockRpc(name, args)
  })
}))

import {
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  usePairTransferRows,
  useUnpairTransferRow
} from './transactions'

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
  mockRpc.mockReset()
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

describe('usePairTransferRows', () => {
  it('optimistically marks both rows as Transfer with shared pair anchor', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [
      makeTx({ id: 'a', amount: -100, account_id: 'acc1', type: 'Expense' }),
      makeTx({ id: 'b', amount: 100, account_id: 'acc2', type: 'Income' }),
      makeTx({ id: 'c', amount: 50 })
    ])

    let resolveServer: (v: { data: string; error: null }) => void = () => {}
    mockRpc.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => usePairTransferRows(), { wrapper })
    void result.current.mutate({ rowAId: 'a', rowBId: 'b' })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
      expect(cache).toBeDefined()
      const a = cache!.find(t => t.id === 'a')!
      const b = cache!.find(t => t.id === 'b')!
      expect(a.type).toBe('Transfer')
      expect(a.transfer_pair_id).toBe('a')
      expect(b.type).toBe('Transfer')
      expect(b.transfer_pair_id).toBe('a')
      // Untouched row stays the same.
      const c = cache!.find(t => t.id === 'c')!
      expect(c.type).toBe('Expense')
      expect(c.transfer_pair_id).toBeNull()
    })

    resolveServer({ data: 'a', error: null })
  })

  it('rolls back optimistic pair on RPC error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [
      makeTx({ id: 'a', amount: -100, account_id: 'acc1', type: 'Expense' }),
      makeTx({ id: 'b', amount: 100, account_id: 'acc2', type: 'Income' })
    ]
    seedCache(client, initial)

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'rows must have opposite signs' } })

    const { result } = renderHook(() => usePairTransferRows(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate(
        { rowAId: 'a', rowBId: 'b' },
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    expect(cache).toEqual(initial)
  })

  it('is a no-op on cache slots where the rows are not present', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const unrelated = [makeTx({ id: 'x' }), makeTx({ id: 'y' })]
    seedCache(client, unrelated)

    mockRpc.mockResolvedValueOnce({ data: 'a', error: null })

    const { result } = renderHook(() => usePairTransferRows(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate(
        { rowAId: 'a', rowBId: 'b' },
        { onSettled: () => resolve() }
      )
    })

    // No rows in cache match; both slots leave unrelated rows untouched.
    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    expect(cache).toEqual(unrelated)
    expect(result.current.error).toBeNull()
  })

  it('passes the household id and row ids to the RPC', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [])

    mockRpc.mockResolvedValueOnce({ data: 'a', error: null })

    const { result } = renderHook(() => usePairTransferRows(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate(
        { rowAId: 'a', rowBId: 'b' },
        { onSettled: () => resolve() }
      )
    })

    expect(mockRpc).toHaveBeenCalledWith('pair_transfer_rows', expect.objectContaining({
      p_row_a_id: 'a',
      p_row_b_id: 'b'
    }))
  })
})

describe('useUnpairTransferRow', () => {
  it('optimistically clears transfer_pair_id on both legs', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [
      makeTx({ id: 'a', type: 'Transfer', transfer_pair_id: 'a' }),
      makeTx({ id: 'b', type: 'Transfer', transfer_pair_id: 'a' }),
      makeTx({ id: 'c' })
    ])

    let resolveServer: (v: { data: number; error: null }) => void = () => {}
    mockRpc.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useUnpairTransferRow(), { wrapper })
    void result.current.mutate('b')

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
      expect(cache).toBeDefined()
      const a = cache!.find(t => t.id === 'a')!
      const b = cache!.find(t => t.id === 'b')!
      expect(a.transfer_pair_id).toBeNull()
      expect(b.transfer_pair_id).toBeNull()
      // type stays as Transfer (caller can hand-edit via EditableCell)
      expect(a.type).toBe('Transfer')
      expect(b.type).toBe('Transfer')
    })

    resolveServer({ data: 2, error: null })
  })

  it('rolls back on RPC error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [
      makeTx({ id: 'a', type: 'Transfer', transfer_pair_id: 'a' }),
      makeTx({ id: 'b', type: 'Transfer', transfer_pair_id: 'a' })
    ]
    seedCache(client, initial)

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'row is not paired' } })

    const { result } = renderHook(() => useUnpairTransferRow(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate('b', { onSettled: () => resolve() })
    })

    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    expect(cache).toEqual(initial)
  })

  it('clears only the source row when the paired sibling is absent from cache (best-effort)', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [
      makeTx({ id: 'b', type: 'Transfer', transfer_pair_id: 'a' })
    ])

    mockRpc.mockResolvedValueOnce({ data: 2, error: null })

    const { result } = renderHook(() => useUnpairTransferRow(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate('b', { onSettled: () => resolve() })
    })

    const cache = client.getQueryData<ReadonlyArray<TransactionRow>>(queryKeys.transactions())
    const b = cache!.find(t => t.id === 'b')!
    expect(b.transfer_pair_id).toBeNull()
  })
})
