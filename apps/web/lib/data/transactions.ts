'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult, type QueryKey } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type TransactionFilters } from './keys'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
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
      if (filters?.minAmount !== undefined && Number.isFinite(filters.minAmount)) {
        q = q.gte('amount', filters.minAmount)
      }
      if (filters?.maxAmount !== undefined && Number.isFinite(filters.maxAmount)) {
        q = q.lte('amount', filters.maxAmount)
      }

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

export interface PairTransferRowsArgs {
  rowAId: string
  rowBId: string
}

interface PairCtx {
  readonly snapshots: ReadonlyArray<readonly [QueryKey, ReadonlyArray<TransactionRow>]>
}

/**
 * Calls the pair_transfer_rows RPC. Optimistically updates both rows
 * across every active transactions cache slot to type='Transfer' +
 * transfer_pair_id=rowAId. Rolls back snapshots on error.
 */
export function usePairTransferRows(): UseMutationResult<string, Error, PairTransferRowsArgs, PairCtx> {
  const queryClient = useQueryClient()

  return useMutation<string, Error, PairTransferRowsArgs, PairCtx>({
    async mutationFn({ rowAId, rowBId }) {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('pair_transfer_rows', {
        p_household_id: LOPEZ_HOUSEHOLD_ID,
        p_row_a_id: rowAId,
        p_row_b_id: rowBId
      })
      if (error) throw error
      if (!data) throw new Error('pair_transfer_rows returned no data')
      return data as string
    },
    async onMutate({ rowAId, rowBId }) {
      await queryClient.cancelQueries({ queryKey: queryKeys.allTransactions() })

      const entries = queryClient.getQueriesData<ReadonlyArray<TransactionRow>>({
        queryKey: queryKeys.allTransactions()
      })
      const snapshots: Array<readonly [QueryKey, ReadonlyArray<TransactionRow>]> = []

      for (const [key, prev] of entries) {
        if (!prev) continue
        snapshots.push([key, prev] as const)
        const next = prev.map(t => {
          if (t.id === rowAId || t.id === rowBId) {
            return { ...t, type: 'Transfer', transfer_pair_id: rowAId } as TransactionRow
          }
          return t
        })
        queryClient.setQueryData<ReadonlyArray<TransactionRow>>(key, next)
      }

      return { snapshots }
    },
    onError(_err, _args, ctx) {
      if (!ctx) return
      for (const [key, snapshot] of ctx.snapshots) {
        queryClient.setQueryData(key, snapshot)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.allTransactions() })
    }
  })
}

interface UnpairCtx {
  readonly snapshots: ReadonlyArray<readonly [QueryKey, ReadonlyArray<TransactionRow>]>
}

/**
 * Calls the unpair_transfer_row RPC. Optimistically clears
 * transfer_pair_id on the source row and its paired sibling (if present
 * in cache). Leaves type='Transfer' so the user can edit via the
 * existing EditableCell flow. Rolls back snapshots on error.
 */
export function useUnpairTransferRow(): UseMutationResult<number, Error, string, UnpairCtx> {
  const queryClient = useQueryClient()

  return useMutation<number, Error, string, UnpairCtx>({
    async mutationFn(rowId) {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('unpair_transfer_row', {
        p_household_id: LOPEZ_HOUSEHOLD_ID,
        p_row_id: rowId
      })
      if (error) throw error
      return (data ?? 0) as number
    },
    async onMutate(rowId) {
      await queryClient.cancelQueries({ queryKey: queryKeys.allTransactions() })

      const entries = queryClient.getQueriesData<ReadonlyArray<TransactionRow>>({
        queryKey: queryKeys.allTransactions()
      })
      const snapshots: Array<readonly [QueryKey, ReadonlyArray<TransactionRow>]> = []

      // Resolve the pair anchor from any cache slot that has the row.
      let pairId: string | null = null
      for (const [, prev] of entries) {
        if (!prev) continue
        const found = prev.find(t => t.id === rowId)
        if (found && found.transfer_pair_id) {
          pairId = found.transfer_pair_id
          break
        }
      }

      for (const [key, prev] of entries) {
        if (!prev) continue
        snapshots.push([key, prev] as const)
        const next = prev.map(t => {
          if (t.id === rowId) {
            return { ...t, transfer_pair_id: null } as TransactionRow
          }
          if (pairId !== null && (t.id === pairId || t.transfer_pair_id === pairId)) {
            return { ...t, transfer_pair_id: null } as TransactionRow
          }
          return t
        })
        queryClient.setQueryData<ReadonlyArray<TransactionRow>>(key, next)
      }

      return { snapshots }
    },
    onError(_err, _rowId, ctx) {
      if (!ctx) return
      for (const [key, snapshot] of ctx.snapshots) {
        queryClient.setQueryData(key, snapshot)
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
