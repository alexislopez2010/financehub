'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type BillRow = Tables<'bills'>
export type BillInsert = TablesInsert<'bills'>
export type BillUpdate = TablesUpdate<'bills'>

export function useBills(): UseQueryResult<ReadonlyArray<BillRow>, Error> {
  return useQuery({
    queryKey: queryKeys.bills(),
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('due_day', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    }
  })
}

interface BillCreateCtx {
  readonly previous: ReadonlyArray<BillRow> | undefined
  readonly key: ReturnType<typeof queryKeys.bills>
}

export function useCreateBill(): UseMutationResult<BillRow, Error, BillInsert, BillCreateCtx> {
  const queryClient = useQueryClient()

  return useMutation<BillRow, Error, BillInsert, BillCreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bills')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.bills()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BillRow>>(key)

      const optimistic: BillRow = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        created_at: null,
        account: null,
        budget_amount: 0,
        category: null,
        due_day: null,
        frequency: null,
        is_active: null,
        linked_debt_id: null,
        notes: null,
        ...payload
      } as BillRow

      queryClient.setQueryData<ReadonlyArray<BillRow>>(key, prev =>
        prev ? [optimistic, ...prev] : [optimistic]
      )

      return { previous, key }
    },
    onError(_err, _payload, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills() })
    }
  })
}

interface BillUpdateCtx {
  readonly previous: ReadonlyArray<BillRow> | undefined
  readonly key: ReturnType<typeof queryKeys.bills>
}

interface BillUpdateArgs {
  id: string
  patch: BillUpdate
}

export function useUpdateBill(): UseMutationResult<BillRow, Error, BillUpdateArgs, BillUpdateCtx> {
  const queryClient = useQueryClient()

  return useMutation<BillRow, Error, BillUpdateArgs, BillUpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bills')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      const key = queryKeys.bills()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BillRow>>(key)
      queryClient.setQueryData<ReadonlyArray<BillRow>>(key, prev =>
        prev ? prev.map(r => (r.id === id ? ({ ...r, ...patch } as BillRow) : r)) : prev
      )
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills() })
    }
  })
}

interface BillDeleteCtx {
  readonly previous: ReadonlyArray<BillRow> | undefined
  readonly key: ReturnType<typeof queryKeys.bills>
}

export function useDeleteBill(): UseMutationResult<void, Error, string, BillDeleteCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, BillDeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('bills').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      const key = queryKeys.bills()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BillRow>>(key)
      queryClient.setQueryData<ReadonlyArray<BillRow>>(key, prev =>
        prev ? prev.filter(r => r.id !== id) : prev
      )
      return { previous, key }
    },
    onError(_err, _id, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.bills() })
    }
  })
}
