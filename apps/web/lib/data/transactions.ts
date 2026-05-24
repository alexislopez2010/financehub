'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type TransactionFilters } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>

/**
 * Returns transactions for the active household, optionally filtered.
 * Default order: date descending, then created_at descending (stable when
 * multiple txs share a date).
 */
export function useTransactions(
  filters?: TransactionFilters
): UseQueryResult<ReadonlyArray<TransactionRow>, Error> {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    async queryFn() {
      const supabase = createClient()
      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.startDate) q = q.gte('date', filters.startDate)
      if (filters?.endDate) q = q.lte('date', filters.endDate)
      if (filters?.categoryId !== undefined) {
        q = filters.categoryId === null
          ? q.is('category_id', null)
          : q.eq('category_id', filters.categoryId)
      }
      if (filters?.account) q = q.eq('account', filters.account)
      if (filters?.member) q = q.eq('member', filters.member)
      if (filters?.type) q = q.eq('type', filters.type)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    }
  })
}

export type TransactionInsert = TablesInsert<'transactions'>
export type TransactionUpdate = TablesUpdate<'transactions'>

/** Optimistic-create context returned by onMutate, consumed by onError. */
interface CreateCtx {
  readonly previous: ReadonlyArray<TransactionRow> | undefined
  readonly key: ReturnType<typeof queryKeys.transactions>
}

/**
 * Optimistically inserts a new transaction. The optimistic row uses a
 * temporary id (`tmp-<random>`) until the server response replaces it
 * via the onSettled invalidation. The first non-filtered transactions
 * cache slot is the optimistic target — that's the slot most surfaces
 * subscribe to. Filter-scoped slots are invalidated on settle.
 */
export function useCreateTransaction(): UseMutationResult<TransactionRow, Error, TransactionInsert, CreateCtx> {
  const queryClient = useQueryClient()

  return useMutation<TransactionRow, Error, TransactionInsert, CreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.transactions()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<TransactionRow>>(key)

      const optimistic: TransactionRow = {
        // sensible defaults for nullable columns
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        created_at: null,
        imported_at: null,
        fingerprint: null,
        category: null,
        category_id: null,
        account: null,
        account_id: null,
        member: null,
        notes: null,
        payment_method: null,
        sub_category: null,
        transfer_group_id: null,
        transfer_pair_id: null,
        ...payload
      } as TransactionRow

      queryClient.setQueryData<ReadonlyArray<TransactionRow>>(key, prev =>
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
      queryClient.invalidateQueries({ queryKey: queryKeys.allTransactions() })
    }
  })
}

interface UpdateCtx {
  readonly previous: ReadonlyArray<TransactionRow> | undefined
  readonly key: ReturnType<typeof queryKeys.transactions>
}

interface UpdateArgs {
  id: string
  patch: TransactionUpdate
}

/**
 * Optimistically patches a single transaction by id. Replaces the row in
 * the cache with `{ ...existing, ...patch }`. Rolls back on error.
 */
export function useUpdateTransaction(): UseMutationResult<TransactionRow, Error, UpdateArgs, UpdateCtx> {
  const queryClient = useQueryClient()

  return useMutation<TransactionRow, Error, UpdateArgs, UpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      const key = queryKeys.transactions()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<TransactionRow>>(key)
      queryClient.setQueryData<ReadonlyArray<TransactionRow>>(key, prev =>
        prev ? prev.map(t => (t.id === id ? ({ ...t, ...patch } as TransactionRow) : t)) : prev
      )
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.allTransactions() })
    }
  })
}

interface DeleteCtx {
  readonly previous: ReadonlyArray<TransactionRow> | undefined
  readonly key: ReturnType<typeof queryKeys.transactions>
}

/**
 * Optimistically removes a transaction from the cache. Rolls back on error.
 */
export function useDeleteTransaction(): UseMutationResult<void, Error, string, DeleteCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, DeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      const key = queryKeys.transactions()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<TransactionRow>>(key)
      queryClient.setQueryData<ReadonlyArray<TransactionRow>>(key, prev =>
        prev ? prev.filter(t => t.id !== id) : prev
      )
      return { previous, key }
    },
    onError(_err, _id, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.allTransactions() })
    }
  })
}
