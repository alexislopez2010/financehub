import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from './keys'
import type { FamilyMemberRow } from './familyMembers'

// Hoisted Supabase mock — must come before SUT import.
// useFamilyMembers chains: from(t).select(cols).eq(c, v).order(c)
// terminal .order(...) returns { data, error }.
// Mutation chains:
//   insert(payload).select().single()  → mockInsertSingle
//   update(patch).eq(c, v).select().single() → mockUpdateSingle
//   delete().eq(c, v) → mockDeleteEq
const mockOrder = vi.fn()
const mockInsertSingle = vi.fn()
const mockUpdateSingle = vi.fn()
const mockDeleteEq = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          order: (col: string, opts?: unknown) => mockOrder(col, opts)
        })
      }),
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

import {
  useFamilyMembers,
  useCreateFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember
} from './familyMembers'

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

function makeRow(over: Partial<FamilyMemberRow> = {}): FamilyMemberRow {
  return {
    id: 'fm1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Olivia Lopez',
    relationship: 'Daughter',
    created_at: '2025-05-01T00:00:00Z',
    ...over
  }
}

function seedCache(client: QueryClient, rows: ReadonlyArray<FamilyMemberRow>): void {
  client.setQueryData(queryKeys.familyMembers(), rows)
}

beforeEach(() => {
  mockOrder.mockReset()
  mockInsertSingle.mockReset()
  mockUpdateSingle.mockReset()
  mockDeleteEq.mockReset()
})

describe('useFamilyMembers', () => {
  it('returns rows ordered by name', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockOrder.mockResolvedValueOnce({
      data: [makeRow({ id: 'a', name: 'Family' }), makeRow({ id: 'b', name: 'Olivia Lopez' })],
      error: null
    })

    const { result } = renderHook(() => useFamilyMembers(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockOrder).toHaveBeenCalledWith('name', undefined)
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]?.name).toBe('Family')
  })

  it('returns an empty array when there are no rows', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockOrder.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useFamilyMembers(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('surfaces SELECT errors', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockOrder.mockResolvedValueOnce({ data: null, error: { message: 'rls denied' } })

    const { result } = renderHook(() => useFamilyMembers(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('rls denied')
  })
})

describe('useCreateFamilyMember', () => {
  it('optimistically appends the new row before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeRow({ id: 'existing', name: 'Family' })])

    let resolveServer: (v: { data: FamilyMemberRow; error: null }) => void = () => {}
    mockInsertSingle.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useCreateFamilyMember(), { wrapper })
    void result.current.mutate({ name: 'New Person', relationship: 'Cousin' })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<FamilyMemberRow>>(queryKeys.familyMembers())
      expect(cache).toBeDefined()
      expect(cache).toHaveLength(2)
      const tmp = cache!.find(r => r.id.startsWith('tmp-'))
      expect(tmp?.name).toBe('New Person')
      expect(tmp?.relationship).toBe('Cousin')
    })

    resolveServer({
      data: makeRow({ id: 'server-id', name: 'New Person', relationship: 'Cousin' }),
      error: null
    })
  })

  it('rolls back optimistic insert on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeRow({ id: 'a' })]
    seedCache(client, initial)

    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } })

    const { result } = renderHook(() => useCreateFamilyMember(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate(
        { name: 'X' },
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<FamilyMemberRow>>(queryKeys.familyMembers())
    expect(cache).toEqual(initial)
  })
})

describe('useUpdateFamilyMember', () => {
  it('optimistically applies the patch before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeRow({ id: 'fm1', name: 'old', relationship: 'Son' })])

    let resolveServer: (v: { data: FamilyMemberRow; error: null }) => void = () => {}
    mockUpdateSingle.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useUpdateFamilyMember(), { wrapper })
    void result.current.mutate({ id: 'fm1', patch: { name: 'new', relationship: 'Daughter' } })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<FamilyMemberRow>>(queryKeys.familyMembers())
      expect(cache?.[0]?.name).toBe('new')
      expect(cache?.[0]?.relationship).toBe('Daughter')
    })

    resolveServer({
      data: makeRow({ id: 'fm1', name: 'new', relationship: 'Daughter' }),
      error: null
    })
  })

  it('rolls back on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeRow({ id: 'fm1', name: 'old' })]
    seedCache(client, initial)

    mockUpdateSingle.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } })

    const { result } = renderHook(() => useUpdateFamilyMember(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate(
        { id: 'fm1', patch: { name: 'new' } },
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<FamilyMemberRow>>(queryKeys.familyMembers())
    expect(cache).toEqual(initial)
  })
})

describe('useDeleteFamilyMember', () => {
  it('optimistically removes the row before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeRow({ id: 'a' }), makeRow({ id: 'b' })])

    let resolveServer: (v: { error: null }) => void = () => {}
    mockDeleteEq.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useDeleteFamilyMember(), { wrapper })
    void result.current.mutate('a')

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<FamilyMemberRow>>(queryKeys.familyMembers())
      expect(cache?.map(r => r.id)).toEqual(['b'])
    })

    resolveServer({ error: null })
  })

  it('rolls back on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeRow({ id: 'a' }), makeRow({ id: 'b' })]
    seedCache(client, initial)

    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'delete failed' } })

    const { result } = renderHook(() => useDeleteFamilyMember(), { wrapper })
    await new Promise<void>(resolve => {
      result.current.mutate('a', { onSettled: () => resolve() })
    })

    const cache = client.getQueryData<ReadonlyArray<FamilyMemberRow>>(queryKeys.familyMembers())
    expect(cache).toEqual(initial)
  })
})
