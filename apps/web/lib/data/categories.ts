'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type CategoryRow = Tables<'categories'>
export type CategoryInsert = TablesInsert<'categories'>
export type CategoryUpdate = TablesUpdate<'categories'>

export function useCategories(): UseQueryResult<ReadonlyArray<CategoryRow>, Error> {
  return useQuery({
    queryKey: queryKeys.categories(),
    staleTime: 5 * 60_000,
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type', { ascending: false })  // 'income' before 'expense' alphabetically actually 'expense' first; use parent_category secondary
        .order('parent_category', { ascending: true, nullsFirst: true })
        .order('name')
      if (error) throw error
      return data ?? []
    }
  })
}

interface CategoryCreateCtx {
  readonly previous: ReadonlyArray<CategoryRow> | undefined
  readonly key: ReturnType<typeof queryKeys.categories>
}

export function useCreateCategory(): UseMutationResult<CategoryRow, Error, CategoryInsert, CategoryCreateCtx> {
  const queryClient = useQueryClient()

  return useMutation<CategoryRow, Error, CategoryInsert, CategoryCreateCtx>({
    async mutationFn(payload) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate(payload) {
      const key = queryKeys.categories()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<CategoryRow>>(key)

      const optimistic: CategoryRow = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        created_at: null,
        is_fixed: null,
        parent_category: null,
        ...payload
      } as CategoryRow

      queryClient.setQueryData<ReadonlyArray<CategoryRow>>(key, prev =>
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
      queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
    }
  })
}

interface CategoryUpdateCtx {
  readonly previous: ReadonlyArray<CategoryRow> | undefined
  readonly key: ReturnType<typeof queryKeys.categories>
}

interface CategoryUpdateArgs {
  id: string
  patch: CategoryUpdate
}

export function useUpdateCategory(): UseMutationResult<CategoryRow, Error, CategoryUpdateArgs, CategoryUpdateCtx> {
  const queryClient = useQueryClient()

  return useMutation<CategoryRow, Error, CategoryUpdateArgs, CategoryUpdateCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      const key = queryKeys.categories()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<CategoryRow>>(key)
      queryClient.setQueryData<ReadonlyArray<CategoryRow>>(key, prev =>
        prev ? prev.map(r => (r.id === id ? ({ ...r, ...patch } as CategoryRow) : r)) : prev
      )
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
    }
  })
}

interface CategoryDeleteCtx {
  readonly previous: ReadonlyArray<CategoryRow> | undefined
  readonly key: ReturnType<typeof queryKeys.categories>
}

export function useDeleteCategory(): UseMutationResult<void, Error, string, CategoryDeleteCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, CategoryDeleteCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      const key = queryKeys.categories()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<CategoryRow>>(key)
      queryClient.setQueryData<ReadonlyArray<CategoryRow>>(key, prev =>
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
      queryClient.invalidateQueries({ queryKey: queryKeys.categories() })
    }
  })
}
