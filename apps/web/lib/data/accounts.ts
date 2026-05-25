'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type AccountRow = Tables<'accounts'>
export type AccountInsert = TablesInsert<'accounts'>
export type AccountUpdate = TablesUpdate<'accounts'>

export function useAccounts(): UseQueryResult<ReadonlyArray<AccountRow>, Error> {
  return useQuery({
    queryKey: queryKeys.accounts(),
    staleTime: 5 * 60_000,  // accounts rarely change
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name')
      if (error) throw error
      return data ?? []
    }
  })
}

interface CreateCtx {
  readonly previous: ReadonlyArray<AccountRow> | undefined
  readonly key: ReturnType<typeof queryKeys.accounts>
}

export function useCreateAccount(): UseMutationResult<AccountRow, Error, AccountInsert, CreateCtx> {
  const queryClient = useQueryClient()
  return useMutation<AccountRow, Error, AccountInsert, CreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase.from('accounts').insert(payload).select().single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.accounts()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<AccountRow>>(key)
      const optimistic: AccountRow = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        created_at: null,
        archived_at: null,
        currency: 'USD',
        display_order: null,
        institution: null,
        is_active: true,
        last_four: null,
        starting_balance: 0,
        starting_balance_date: null,
        type: null,
        ...payload
      } as AccountRow
      queryClient.setQueryData<ReadonlyArray<AccountRow>>(key, prev =>
        prev ? [...prev, optimistic] : [optimistic]
      )
      return { previous, key }
    },
    onError(_e, _p, ctx) { if (ctx) queryClient.setQueryData(ctx.key, ctx.previous) },
    onSettled() { queryClient.invalidateQueries({ queryKey: queryKeys.accounts() }) }
  })
}

interface UpdateCtx {
  readonly previous: ReadonlyArray<AccountRow> | undefined
  readonly key: ReturnType<typeof queryKeys.accounts>
}

interface UpdateArgs {
  id: string
  patch: AccountUpdate
}

export function useUpdateAccount(): UseMutationResult<AccountRow, Error, UpdateArgs, UpdateCtx> {
  const queryClient = useQueryClient()
  return useMutation<AccountRow, Error, UpdateArgs, UpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase.from('accounts').update(patch).eq('id', id).select().single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      const key = queryKeys.accounts()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<AccountRow>>(key)
      queryClient.setQueryData<ReadonlyArray<AccountRow>>(key, prev =>
        prev ? prev.map(a => (a.id === id ? ({ ...a, ...patch } as AccountRow) : a)) : prev
      )
      return { previous, key }
    },
    onError(_e, _v, ctx) { if (ctx) queryClient.setQueryData(ctx.key, ctx.previous) },
    onSettled() { queryClient.invalidateQueries({ queryKey: queryKeys.accounts() }) }
  })
}

interface DeleteCtx {
  readonly previous: ReadonlyArray<AccountRow> | undefined
  readonly key: ReturnType<typeof queryKeys.accounts>
}

export function useDeleteAccount(): UseMutationResult<void, Error, string, DeleteCtx> {
  const queryClient = useQueryClient()
  return useMutation<void, Error, string, DeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      const key = queryKeys.accounts()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<AccountRow>>(key)
      queryClient.setQueryData<ReadonlyArray<AccountRow>>(key, prev =>
        prev ? prev.filter(a => a.id !== id) : prev
      )
      return { previous, key }
    },
    onError(_e, _id, ctx) { if (ctx) queryClient.setQueryData(ctx.key, ctx.previous) },
    onSettled() { queryClient.invalidateQueries({ queryKey: queryKeys.accounts() }) }
  })
}
