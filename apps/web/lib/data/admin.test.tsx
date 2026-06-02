import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryKeys } from './keys'
import type { HouseholdMemberRow } from './admin'

// Hoisted Supabase mock — must come before SUT import.
const mockRpc = vi.fn()
const mockInvoke = vi.fn()
// useHouseholdMembers also queries household_members directly for is_active.
// Each test that exercises useHouseholdMembers should queue a row set here.
const mockFromHouseholdMembersRows = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
    from: (table: string) => {
      // Builder mimicking supabase-js's chained select/eq.
      const builder = {
        select: (_cols: string) => builder,
        eq: (_col: string, _val: unknown) => mockFromHouseholdMembersRows(table)
      }
      return builder
    },
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
  useAddHouseholdMember,
  useResetHouseholdMemberPassword,
  useSetHouseholdMemberActive,
  usePromoteFamilyMember
} from './admin'
import { queryKeys as qk } from './keys'

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
    is_active: true,
    ...over
  }
}

beforeEach(() => {
  mockRpc.mockReset()
  mockInvoke.mockReset()
  mockFromHouseholdMembersRows.mockReset()
  // Default: no is_active flag rows — useHouseholdMembers will treat all as active.
  mockFromHouseholdMembersRows.mockResolvedValue({ data: [], error: null })
})

describe('useHouseholdMembers', () => {
  it('returns normalized rows merged with is_active when the RPC succeeds', async () => {
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
    mockFromHouseholdMembersRows.mockResolvedValueOnce({
      data: [
        { user_id: 'u1', is_active: true },
        { user_id: 'u2', is_active: false }
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
        joined_at: '2025-01-01T00:00:00Z',
        is_active: true
      },
      {
        user_id: 'u2',
        email: 'm@example.com',
        display_name: null,
        role: 'member',
        mfa_factors: 0,
        joined_at: '',
        is_active: false
      }
    ])
  })

  it('defaults missing is_active flag rows to active=true', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockRpc.mockResolvedValueOnce({
      data: [
        {
          user_id: 'u1',
          email: 'owner@example.com',
          display_name: 'Owner',
          role: 'owner',
          mfa_factors: 0,
          joined_at: '2025-01-01T00:00:00Z'
        }
      ],
      error: null
    })
    // No matching flag row.
    mockFromHouseholdMembersRows.mockResolvedValueOnce({ data: [], error: null })

    const { result } = renderHook(() => useHouseholdMembers(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.[0]?.is_active).toBe(true)
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

describe('useResetHouseholdMemberPassword', () => {
  it('invokes the Edge Function with the right body and returns just the email', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, email: 'b@example.com' },
      error: null
    })

    const { result } = renderHook(() => useResetHouseholdMemberPassword(), { wrapper })

    const res = await result.current.mutateAsync({
      household_id: '00000000-0000-0000-0000-000000000001',
      target_user_id: 'u2'
    })

    expect(mockInvoke).toHaveBeenCalledWith('reset-household-member-password', {
      body: {
        household_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: 'u2'
      }
    })
    expect(res).toEqual({ email: 'b@example.com' })
  })

  it('throws when the Edge Function returns an error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'only owners can reset passwords' }
    })

    const { result } = renderHook(() => useResetHouseholdMemberPassword(), { wrapper })

    await expect(
      result.current.mutateAsync({
        household_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: 'u2'
      })
    ).rejects.toMatchObject({ message: 'only owners can reset passwords' })
  })

  it('throws when the Edge Function returns an unexpected shape', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    // Missing the `ok: true` envelope.
    mockInvoke.mockResolvedValueOnce({
      data: { email: 'b@example.com' },
      error: null
    })

    const { result } = renderHook(() => useResetHouseholdMemberPassword(), { wrapper })

    await expect(
      result.current.mutateAsync({
        household_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: 'u2'
      })
    ).rejects.toThrow(/unexpected response/)
  })
})

describe('useSetHouseholdMemberActive', () => {
  it('invokes the Edge Function with the right body and returns the stripped payload', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeMember({ user_id: 'u2', is_active: true })])

    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, user_id: 'u2', active: false },
      error: null
    })

    const { result } = renderHook(() => useSetHouseholdMemberActive(), { wrapper })

    const res = await result.current.mutateAsync({
      household_id: '00000000-0000-0000-0000-000000000001',
      target_user_id: 'u2',
      active: false
    })

    expect(mockInvoke).toHaveBeenCalledWith('set-household-member-active', {
      body: {
        household_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: 'u2',
        active: false
      }
    })
    expect(res).toEqual({ user_id: 'u2', active: false })
  })

  it('optimistically flips is_active in the cache before the server replies', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [
      makeMember({ user_id: 'u1', is_active: true }),
      makeMember({ user_id: 'u2', email: 'b@example.com', display_name: 'Bob', is_active: true })
    ])

    let resolveServer: (v: { data: { ok: true; user_id: string; active: boolean }; error: null }) => void = () => {}
    mockInvoke.mockReturnValueOnce(new Promise(r => { resolveServer = r }))

    const { result } = renderHook(() => useSetHouseholdMemberActive(), { wrapper })
    void result.current.mutate({
      household_id: '00000000-0000-0000-0000-000000000001',
      target_user_id: 'u2',
      active: false
    })

    await waitFor(() => {
      const cache = client.getQueryData<ReadonlyArray<HouseholdMemberRow>>(queryKeys.householdMembers())
      const u2 = cache?.find(r => r.user_id === 'u2')
      expect(u2?.is_active).toBe(false)
    })

    resolveServer({ data: { ok: true, user_id: 'u2', active: false }, error: null })
  })

  it('rolls back the cache on server error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const initial = [makeMember({ user_id: 'u2', is_active: true })]
    seedCache(client, initial)

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'owners cannot disable their own account' }
    })

    const { result } = renderHook(() => useSetHouseholdMemberActive(), { wrapper })

    await new Promise<void>(resolve => {
      result.current.mutate(
        {
          household_id: '00000000-0000-0000-0000-000000000001',
          target_user_id: 'u2',
          active: false
        },
        { onSettled: () => resolve() }
      )
    })

    const cache = client.getQueryData<ReadonlyArray<HouseholdMemberRow>>(queryKeys.householdMembers())
    expect(cache).toEqual(initial)
  })

  it('throws when the Edge Function returns an unexpected shape', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    seedCache(client, [makeMember({ user_id: 'u2', is_active: true })])

    // Missing the `ok: true` envelope.
    mockInvoke.mockResolvedValueOnce({
      data: { user_id: 'u2', active: false },
      error: null
    })

    const { result } = renderHook(() => useSetHouseholdMemberActive(), { wrapper })

    await expect(
      result.current.mutateAsync({
        household_id: '00000000-0000-0000-0000-000000000001',
        target_user_id: 'u2',
        active: false
      })
    ).rejects.toThrow(/unexpected response/)
  })
})

describe('usePromoteFamilyMember', () => {
  it('maps the Edge Function response to camelCase and invalidates both caches on success', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')

    mockInvoke.mockResolvedValueOnce({
      data: {
        user_id: 'new-user-uuid',
        email: 'olivia@example.com',
        initial_password: 'abc123XYZ!@#$',
        display_name: 'Olivia Lopez',
        role: 'member'
      },
      error: null
    })

    const { result } = renderHook(() => usePromoteFamilyMember(), { wrapper })

    const res = await result.current.mutateAsync({
      family_member_id: 'fm1',
      email: 'olivia@example.com',
      displayName: 'Olivia Lopez',
      role: 'member'
    })

    expect(mockInvoke).toHaveBeenCalledWith('promote-family-member', {
      body: {
        household_id: '00000000-0000-0000-0000-000000000001',
        family_member_id: 'fm1',
        email: 'olivia@example.com',
        display_name: 'Olivia Lopez',
        role: 'member'
      }
    })

    expect(res).toEqual({
      userId: 'new-user-uuid',
      email: 'olivia@example.com',
      initialPassword: 'abc123XYZ!@#$',
      displayName: 'Olivia Lopez',
      role: 'member'
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.householdMembers() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: qk.familyMembers() })
  })

  it('throws when the Edge Function returns an error', async () => {
    const client = makeClient()
    const wrapper = makeWrapper(client)

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'only owners can promote' }
    })

    const { result } = renderHook(() => usePromoteFamilyMember(), { wrapper })

    await expect(
      result.current.mutateAsync({
        family_member_id: 'fm1',
        email: 'olivia@example.com'
      })
    ).rejects.toMatchObject({ message: 'only owners can promote' })
  })
})
