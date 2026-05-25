'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type BillMatchRuleRow = Tables<'bill_match_rules'>
export type BillMatchRuleInsert = TablesInsert<'bill_match_rules'>
export type BillMatchRuleUpdate = TablesUpdate<'bill_match_rules'>

export function useBillMatchRules(): UseQueryResult<ReadonlyArray<BillMatchRuleRow>, Error> {
  return useQuery({
    queryKey: queryKeys.billMatchRules(),
    staleTime: 5 * 60_000,  // rules rarely change
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bill_match_rules')
        .select('*')
      if (error) throw error
      return data ?? []
    }
  })
}

interface BillMatchRuleCreateCtx {
  readonly previous: ReadonlyArray<BillMatchRuleRow> | undefined
  readonly key: ReturnType<typeof queryKeys.billMatchRules>
}

export function useCreateBillMatchRule(): UseMutationResult<BillMatchRuleRow, Error, BillMatchRuleInsert, BillMatchRuleCreateCtx> {
  const queryClient = useQueryClient()

  return useMutation<BillMatchRuleRow, Error, BillMatchRuleInsert, BillMatchRuleCreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bill_match_rules')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.billMatchRules()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BillMatchRuleRow>>(key)

      const optimistic: BillMatchRuleRow = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        created_at: null,
        account_filter: null,
        bill_id: null,
        bill_name: null,
        category: null,
        keyword: null,
        sub_category: null,
        ...payload
      } as BillMatchRuleRow

      queryClient.setQueryData<ReadonlyArray<BillMatchRuleRow>>(key, prev =>
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
      queryClient.invalidateQueries({ queryKey: queryKeys.billMatchRules() })
    }
  })
}

interface BillMatchRuleUpdateCtx {
  readonly previous: ReadonlyArray<BillMatchRuleRow> | undefined
  readonly key: ReturnType<typeof queryKeys.billMatchRules>
}

interface BillMatchRuleUpdateArgs {
  id: string
  patch: BillMatchRuleUpdate
}

export function useUpdateBillMatchRule(): UseMutationResult<BillMatchRuleRow, Error, BillMatchRuleUpdateArgs, BillMatchRuleUpdateCtx> {
  const queryClient = useQueryClient()

  return useMutation<BillMatchRuleRow, Error, BillMatchRuleUpdateArgs, BillMatchRuleUpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bill_match_rules')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      const key = queryKeys.billMatchRules()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BillMatchRuleRow>>(key)
      queryClient.setQueryData<ReadonlyArray<BillMatchRuleRow>>(key, prev =>
        prev ? prev.map(r => (r.id === id ? ({ ...r, ...patch } as BillMatchRuleRow) : r)) : prev
      )
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.billMatchRules() })
    }
  })
}

interface BillMatchRuleDeleteCtx {
  readonly previous: ReadonlyArray<BillMatchRuleRow> | undefined
  readonly key: ReturnType<typeof queryKeys.billMatchRules>
}

export function useDeleteBillMatchRule(): UseMutationResult<void, Error, string, BillMatchRuleDeleteCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, BillMatchRuleDeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('bill_match_rules').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      const key = queryKeys.billMatchRules()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BillMatchRuleRow>>(key)
      queryClient.setQueryData<ReadonlyArray<BillMatchRuleRow>>(key, prev =>
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
      queryClient.invalidateQueries({ queryKey: queryKeys.billMatchRules() })
    }
  })
}
