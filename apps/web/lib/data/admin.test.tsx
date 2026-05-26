import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from './keys'
import type { HouseholdMemberRow } from './admin'

// Hoisted Supabase mock — must come before SUT import.
const mockRpc = vi.fn()
const mockInvoke = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
    functions: {
      invoke: (name: string, opts: unknown) => mockInvoke(name, opts)
    }
  })
}))

import {
  useHouseholdMembers,
  useUpdateHouseholdMember,
  useResetMfa,
  useRemoveHouseholdMember,
  useAddHouseholdMember
} from './admin'

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

function seedCache(client: QueryClient, rows: ReadonlyArray<HouseholdMemberRow>): void {
  client.setQueryData(queryKeys.householdMembers(), rows)
}

function makeMember(over: Partial<HouseholdMemberRow> = {}): HouseholdMemberRow {
  return {
    user_id: 'u1',
    email: 'a@example.com',
    display_name: 'Alex',
    role: 'member',
    mfa_factors: 1,
    joined_at: '2025-01-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  mockRpc.mockReset()
  mockInvoke.mockReset()
})

describe('useHouseholdMembers', () => {
  it('returns normalized rows when the RPC succeeds', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockRpc.mockResolvedValueOnce({
      data: [
        {
          user_id: 'u1',
          email: 'owner@example.com',
          display_name: 'Owner',
          role: 'owner',
          mfa_factors: 2,
          joined_at: '2025-01-01T00:00:00Z'
        },
        {
          user_id: 'u2',
          email: 'm@example.com',
          display_name: null,
          // unknown text from PG — narrowed to 'member'
          role: 'something-weird',
          mfa_factors: null,
          joined_at: null
        }
      ],
      error: null
    })

    const { result } = renderHook(() => useHouseholdMembers(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockRpc).toHaveBeenCalledWith('admin_list_household_users', {
      h_id: '00000000-0000-0000-0000-000000000001'
    })
    expect(result.current.data).toEqual([
      {
        user_id: 'u1',
        email: 'owner@example.com',
        display_name: 'Owner',
        role: 'owner',
        mfa_factors: 2,
        joined_at: '2025-01-01T00:00:00Z'
      },
      {
        user_id: 'u2',
        email: 'm@example.com',
        display_name: null,
        role: 'member',
        mfa_factors: 0,
        joined_at: ''
      }
    ])
  })

  it('surfaces the error message when the RPC errors', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'not authorized' } })

    const { result } = renderHook(() => useHouseholdMembers(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('not authorized')
  })
})

describe('useUpdateHouseholdMember', () => {
  it('optimistically applies the patch before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeMember({ user_id: 'u1', display_name: 'old', role: 'member' })])

    let resolveServer: (v: { data: null; error: null }) => void = () => {}
    mockRpc.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useUpdateHouseholdMember(), { wrapper })
    void result.current.mutate({ target_user: 'u1', patch: { display_name: 'new', role: 'owner' } })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<HouseholdMemberRow>>(queryKeys.householdMembers())
      expect(cache?.[0]?.display_name).toBe('new')
      expect(cache?.[0]?.role).toBe('owner')
    })

    resolveServer({ data: null, error: null })
  })

  it('rolls back on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeMember({ user_id: 'u1', display_name: 'old' })]
    seedCache(client, initial)

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'last owner protected' } })

    const { result } = renderHook(() => useUpdateHouseholdMember(), { wrapper })

    await new Promise<void>(resolve => {
      result.current.mutate(
        { target_user: 'u1', patch: { display_name: 'new' } },
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<HouseholdMemberRow>>(queryKeys.householdMembers())
    expect(cache).toEqual(initial)
  })
})

describe('useResetMfa', () => {
  it('returns the count of factors removed', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockRpc.mockResolvedValueOnce({ data: 2, error: null })

    const { result } = renderHook(() => useResetMfa(), { wrapper })

    const factors = await result.current.mutateAsync({ target_user: 'u2' })
    expect(factors).toBe(2)
    expect(mockRpc).toHaveBeenCalledWith('admin_reset_user_mfa', {
      h_id: '00000000-0000-0000-0000-000000000001',
      target_user: 'u2'
    })
  })

  it('coerces a non-numeric data payload to 0', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockRpc.mockResolvedValueOnce({ data: null, error: null })

    const { result } = renderHook(() => useResetMfa(), { wrapper })
    const factors = await result.current.mutateAsync({ target_user: 'u2' })
    expect(factors).toBe(0)
  })

  it('invalidates householdMembers on settle so mfa_factors refreshes', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    mockRpc.mockResolvedValueOnce({ data: 1, error: null })

    const { result } = renderHook(() => useResetMfa(), { wrapper })
    await result.current.mutateAsync({ target_user: 'u2' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.householdMembers() })
  })
})

describe('useRemoveHouseholdMember', () => {
  it('optimistically drops the row before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [
      makeMember({ user_id: 'u1' }),
      makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob' })
    ])

    let resolveServer: (v: { data: null; error: null }) => void = () => {}
    mockRpc.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useRemoveHouseholdMember(), { wrapper })
    void result.current.mutate({ target_user: 'u2' })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<HouseholdMemberRow>>(queryKeys.householdMembers())
      expect(cache?.map(r => r.user_id)).toEqual(['u1'])
    })

    resolveServer({ data: null, error: null })
  })

  it('rolls back on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeMember({ user_id: 'u1' }), makeMember({ user_id: 'u2' })]
    seedCache(client, initial)

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'cannot remove owner directly' } })

    const { result } = renderHook(() => useRemoveHouseholdMember(), { wrapper })

    await new Promise<void>(resolve => {
      result.current.mutate({ target_user: 'u2' }, { onSettled: () => resolve() })
    })

    const cache = client.getQueryData<ReadonlyArray<HouseholdMemberRow>>(queryKeys.householdMembers())
    expect(cache).toEqual(initial)
  })
})

describe('useAddHouseholdMember', () => {
  it('maps the Edge Function response to camelCase and invokes with the right body', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockInvoke.mockResolvedValueOnce({
      data: {
        user_id: 'new-user-uuid',
        email: 'new@example.com',
        initial_password: 'abc123XYZ!@#$%^&*',
        display_name: 'New Person',
        role: 'member'
      },
      error: null
    })

    const { result } = renderHook(() => useAddHouseholdMember(), { wrapper })

    const res = await result.current.mutateAsync({
      email: 'new@example.com',
      displayName: 'New Person',
      role: 'member'
    })

    expect(mockInvoke).toHaveBeenCalledWith('add-household-member', {
      body: {
        household_id: '00000000-0000-0000-0000-000000000001',
        email: 'new@example.com',
        display_name: 'New Person',
        role: 'member'
      }
    })

    expect(res).toEqual({
      userId: 'new-user-uuid',
      email: 'new@example.com',
      initialPassword: 'abc123XYZ!@#$%^&*',
      displayName: 'New Person',
      role: 'member'
    })
  })

  it('throws when the Edge Function returns an error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'only owners can add members' }
    })

    const { result } = renderHook(() => useAddHouseholdMember(), { wrapper })

    await expect(
      result.current.mutateAsync({
        email: 'who@example.com',
        displayName: 'Who',
        role: 'member'
      })
    ).rejects.toMatchObject({ message: 'only owners can add members' })
  })

  it('throws when the Edge Function returns an unexpected shape', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    // Missing initial_password + user_id fields.
    mockInvoke.mockResolvedValueOnce({
      data: { email: 'oops@example.com' },
      error: null
    })

    const { result } = renderHook(() => useAddHouseholdMember(), { wrapper })

    await expect(
      result.current.mutateAsync({
        email: 'oops@example.com',
        displayName: 'Oops',
        role: 'member'
      })
    ).rejects.toThrow(/unexpected response/)
  })

  it('invalidates householdMembers on success so the list refetches', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    mockInvoke.mockResolvedValueOnce({
      data: {
        user_id: 'new-id',
        email: 'a@b.co',
        initial_password: 'pw',
        display_name: 'A',
        role: 'owner'
      },
      error: null
    })

    const { result } = renderHook(() => useAddHouseholdMember(), { wrapper })
    await result.current.mutateAsync({
      email: 'a@b.co',
      displayName: 'A',
      role: 'owner'
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.householdMembers() })
  })
})
