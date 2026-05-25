'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type BudgetPeriod } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type BudgetRow = Tables<'budgets'>
export type BudgetInsert = TablesInsert<'budgets'>
export type BudgetUpdate = TablesUpdate<'budgets'>

export function useBudgets(period: BudgetPeriod): UseQueryResult<ReadonlyArray<BudgetRow>, Error> {
  return useQuery({
    queryKey: queryKeys.budgets(period),
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('year', period.year)
        .eq('month', period.month)
        .order('category')
      if (error) throw error
      return data ?? []
    }
  })
}

interface BudgetCreateCtx {
  readonly previous: ReadonlyArray<BudgetRow> | undefined
  readonly key: ReturnType<typeof queryKeys.budgets>
}

export function useCreateBudget(): UseMutationResult<BudgetRow, Error, BudgetInsert, BudgetCreateCtx> {
  const queryClient = useQueryClient()

  return useMutation<BudgetRow, Error, BudgetInsert, BudgetCreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('budgets')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.budgets({ year: payload.year, month: payload.month })
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<BudgetRow>>(key)

      if (previous) {
        const optimistic: BudgetRow = {
          id: `tmp-${Math.random().toString(36).slice(2)}`,
          created_at: null,
          amount: 0,
          category_id: null,
          sub_category: null,
          ...payload
        } as BudgetRow

        queryClient.setQueryData<ReadonlyArray<BudgetRow>>(key, [...previous, optimistic])
      }

      return { previous, key }
    },
    onError(_err, _payload, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    }
  })
}

interface BudgetUpdateCtx {
  readonly previous: ReadonlyArray<BudgetRow> | undefined
  readonly key: ReturnType<typeof queryKeys.budgets>
}

interface BudgetUpdateArgs {
  id: string
  patch: BudgetUpdate
}

export function useUpdateBudget(): UseMutationResult<BudgetRow, Error, BudgetUpdateArgs, BudgetUpdateCtx> {
  const queryClient = useQueryClient()

  return useMutation<BudgetRow, Error, BudgetUpdateArgs, BudgetUpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('budgets')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      // Find the cache slot that currently holds this row
      const queries = queryClient.getQueriesData<ReadonlyArray<BudgetRow>>({ queryKey: ['budgets'] })
      let targetKey: ReturnType<typeof queryKeys.budgets> | undefined
      let previous: ReadonlyArray<BudgetRow> | undefined

      for (const [qKey, qData] of queries) {
        if (qData?.some(r => r.id === id)) {
          targetKey = qKey as ReturnType<typeof queryKeys.budgets>
          previous = qData
          break
        }
      }

      // Fallback: use an arbitrary period key if we can't locate the row
      if (!targetKey) {
        const now = new Date()
        targetKey = queryKeys.budgets({ year: now.getFullYear(), month: now.getMonth() + 1 })
      }

      await queryClient.cancelQueries({ queryKey: targetKey })
      if (previous) {
        queryClient.setQueryData<ReadonlyArray<BudgetRow>>(targetKey, prev =>
          prev ? prev.map(r => (r.id === id ? ({ ...r, ...patch } as BudgetRow) : r)) : prev
        )
      }

      return { previous, key: targetKey }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    }
  })
}

interface BudgetDeleteCtx {
  readonly previous: ReadonlyArray<BudgetRow> | undefined
  readonly key: ReturnType<typeof queryKeys.budgets>
}

export function useDeleteBudget(): UseMutationResult<void, Error, string, BudgetDeleteCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, BudgetDeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('budgets').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      // Find the cache slot that currently holds this row
      const queries = queryClient.getQueriesData<ReadonlyArray<BudgetRow>>({ queryKey: ['budgets'] })
      let targetKey: ReturnType<typeof queryKeys.budgets> | undefined
      let previous: ReadonlyArray<BudgetRow> | undefined

      for (const [qKey, qData] of queries) {
        if (qData?.some(r => r.id === id)) {
          targetKey = qKey as ReturnType<typeof queryKeys.budgets>
          previous = qData
          break
        }
      }

      if (!targetKey) {
        const now = new Date()
        targetKey = queryKeys.budgets({ year: now.getFullYear(), month: now.getMonth() + 1 })
      }

      await queryClient.cancelQueries({ queryKey: targetKey })
      if (previous) {
        queryClient.setQueryData<ReadonlyArray<BudgetRow>>(targetKey, prev =>
          prev ? prev.filter(r => r.id !== id) : prev
        )
      }

      return { previous, key: targetKey }
    },
    onError(_err, _id, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: ['budgets'] })
    }
  })
}
