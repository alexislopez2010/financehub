'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type IncomePlanPeriod } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type IncomePlanRow = Tables<'income_plan'>
export type IncomePlanInsert = TablesInsert<'income_plan'>
export type IncomePlanUpdate = TablesUpdate<'income_plan'>

export function useIncomePlan(period: IncomePlanPeriod): UseQueryResult<ReadonlyArray<IncomePlanRow>, Error> {
  return useQuery({
    queryKey: queryKeys.incomePlan(period),
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('income_plan')
        .select('*')
        .eq('year', period.year)
        .order('month')
        .order('source')
      if (error) throw error
      return data ?? []
    }
  })
}

interface IncomePlanCreateCtx {
  readonly previous: ReadonlyArray<IncomePlanRow> | undefined
  readonly key: ReturnType<typeof queryKeys.incomePlan>
}

export function useCreateIncomePlan(): UseMutationResult<IncomePlanRow, Error, IncomePlanInsert, IncomePlanCreateCtx> {
  const queryClient = useQueryClient()

  return useMutation<IncomePlanRow, Error, IncomePlanInsert, IncomePlanCreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('income_plan')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.incomePlan({ year: payload.year })
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<IncomePlanRow>>(key)

      if (previous) {
        const optimistic: IncomePlanRow = {
          id: `tmp-${Math.random().toString(36).slice(2)}`,
          created_at: null,
          day_of_month: null,
          expected_amount: 0,
          frequency: 'monthly',
          is_active: true,
          member: null,
          notes: null,
          ...payload
        } as IncomePlanRow

        queryClient.setQueryData<ReadonlyArray<IncomePlanRow>>(key, [...previous, optimistic])
      }

      return { previous, key }
    },
    onError(_err, _payload, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: ['incomePlan'] })
    }
  })
}

interface IncomePlanUpdateCtx {
  readonly previous: ReadonlyArray<IncomePlanRow> | undefined
  readonly key: ReturnType<typeof queryKeys.incomePlan>
}

interface IncomePlanUpdateArgs {
  id: string
  patch: IncomePlanUpdate
}

export function useUpdateIncomePlan(): UseMutationResult<IncomePlanRow, Error, IncomePlanUpdateArgs, IncomePlanUpdateCtx> {
  const queryClient = useQueryClient()

  return useMutation<IncomePlanRow, Error, IncomePlanUpdateArgs, IncomePlanUpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('income_plan')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      // Find the year-scoped cache slot that holds this row
      const queries = queryClient.getQueriesData<ReadonlyArray<IncomePlanRow>>({ queryKey: ['incomePlan'] })
      let targetKey: ReturnType<typeof queryKeys.incomePlan> | undefined
      let previous: ReadonlyArray<IncomePlanRow> | undefined

      for (const [qKey, qData] of queries) {
        if (qData?.some(r => r.id === id)) {
          targetKey = qKey as ReturnType<typeof queryKeys.incomePlan>
          previous = qData
          break
        }
      }

      if (!targetKey) {
        targetKey = queryKeys.incomePlan({ year: new Date().getFullYear() })
      }

      await queryClient.cancelQueries({ queryKey: targetKey })
      if (previous) {
        queryClient.setQueryData<ReadonlyArray<IncomePlanRow>>(targetKey, prev =>
          prev ? prev.map(r => (r.id === id ? ({ ...r, ...patch } as IncomePlanRow) : r)) : prev
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
      queryClient.invalidateQueries({ queryKey: ['incomePlan'] })
    }
  })
}

interface IncomePlanDeleteCtx {
  readonly previous: ReadonlyArray<IncomePlanRow> | undefined
  readonly key: ReturnType<typeof queryKeys.incomePlan>
}

export function useDeleteIncomePlan(): UseMutationResult<void, Error, string, IncomePlanDeleteCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, IncomePlanDeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('income_plan').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      // Find the year-scoped cache slot that holds this row
      const queries = queryClient.getQueriesData<ReadonlyArray<IncomePlanRow>>({ queryKey: ['incomePlan'] })
      let targetKey: ReturnType<typeof queryKeys.incomePlan> | undefined
      let previous: ReadonlyArray<IncomePlanRow> | undefined

      for (const [qKey, qData] of queries) {
        if (qData?.some(r => r.id === id)) {
          targetKey = qKey as ReturnType<typeof queryKeys.incomePlan>
          previous = qData
          break
        }
      }

      if (!targetKey) {
        targetKey = queryKeys.incomePlan({ year: new Date().getFullYear() })
      }

      await queryClient.cancelQueries({ queryKey: targetKey })
      if (previous) {
        queryClient.setQueryData<ReadonlyArray<IncomePlanRow>>(targetKey, prev =>
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
      queryClient.invalidateQueries({ queryKey: ['incomePlan'] })
    }
  })
}
