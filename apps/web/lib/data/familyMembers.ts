'use client'

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult
} from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'

export type FamilyMemberRow = Tables<'family_members'>
export type FamilyMemberInsert = TablesInsert<'family_members'>
export type FamilyMemberUpdate = TablesUpdate<'family_members'>

/**
 * Lists every placeholder member of the Lopez household. Placeholder members
 * are "people without a login" (kids, family references, etc.) — distinct
 * from the auth-backed rows in `household_members`. The Members admin shows
 * both lists in the same card.
 */
export function useFamilyMembers(): UseQueryResult<ReadonlyArray<FamilyMemberRow>, Error> {
  return useQuery({
    queryKey: queryKeys.familyMembers(),
    staleTime: 60_000,
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('household_id', LOPEZ_HOUSEHOLD_ID)
        .order('name')
      if (error) throw error
      return data ?? []
    }
  })
}

export interface CreateFamilyMemberArgs {
  name: string
  relationship?: string | null
}

interface FamilyMemberListCtx {
  readonly previous: ReadonlyArray<FamilyMemberRow> | undefined
  readonly key: ReturnType<typeof queryKeys.familyMembers>
}

/**
 * Inserts a new placeholder member. Optimistically prepends an in-memory row
 * keyed by a `tmp-` id; the server insert returns the real row which the
 * settle invalidation refetches.
 */
export function useCreateFamilyMember(): UseMutationResult<
  FamilyMemberRow,
  Error,
  CreateFamilyMemberArgs,
  FamilyMemberListCtx
> {
  const queryClient = useQueryClient()

  return useMutation<FamilyMemberRow, Error, CreateFamilyMemberArgs, FamilyMemberListCtx>({
    async mutationFn({ name, relationship }) {
      const supabase = createClient()
      const payload: FamilyMemberInsert = {
        household_id: LOPEZ_HOUSEHOLD_ID,
        name,
        relationship: relationship ?? null
      }
      const { data, error } = await supabase
        .from('family_members')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Insert returned no data')
      return data
    },
    async onMutate({ name, relationship }) {
      const key = queryKeys.familyMembers()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<FamilyMemberRow>>(key)

      const optimistic: FamilyMemberRow = {
        id: `tmp-${Math.random().toString(36).slice(2)}`,
        household_id: LOPEZ_HOUSEHOLD_ID,
        name,
        relationship: relationship ?? null,
        created_at: null
      }

      queryClient.setQueryData<ReadonlyArray<FamilyMemberRow>>(key, prev =>
        prev ? [...prev, optimistic].sort((a, b) => a.name.localeCompare(b.name)) : [optimistic]
      )

      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers() })
    }
  })
}

export interface UpdateFamilyMemberArgs {
  id: string
  patch: { name?: string; relationship?: string | null }
}

/** Edits a placeholder member's name and/or relationship. Optimistic patch. */
export function useUpdateFamilyMember(): UseMutationResult<
  FamilyMemberRow,
  Error,
  UpdateFamilyMemberArgs,
  FamilyMemberListCtx
> {
  const queryClient = useQueryClient()

  return useMutation<FamilyMemberRow, Error, UpdateFamilyMemberArgs, FamilyMemberListCtx>({
    async mutationFn({ id, patch }) {
      const supabase = createClient()
      const update: FamilyMemberUpdate = {}
      if (patch.name !== undefined) update.name = patch.name
      if (patch.relationship !== undefined) update.relationship = patch.relationship

      const { data, error } = await supabase
        .from('family_members')
        .update(update)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      if (!data) throw new Error('Update returned no data')
      return data
    },
    async onMutate({ id, patch }) {
      const key = queryKeys.familyMembers()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<FamilyMemberRow>>(key)
      queryClient.setQueryData<ReadonlyArray<FamilyMemberRow>>(key, prev =>
        prev
          ? prev.map(r =>
              r.id === id
                ? {
                    ...r,
                    name: patch.name ?? r.name,
                    relationship: patch.relationship !== undefined ? patch.relationship : r.relationship
                  }
                : r
            )
          : prev
      )
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers() })
    }
  })
}

/** Deletes a placeholder member. Optimistic remove. */
export function useDeleteFamilyMember(): UseMutationResult<
  void,
  Error,
  string,
  FamilyMemberListCtx
> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, string, FamilyMemberListCtx>({
    async mutationFn(id) {
      const supabase = createClient()
      const { error } = await supabase.from('family_members').delete().eq('id', id)
      if (error) throw error
    },
    async onMutate(id) {
      const key = queryKeys.familyMembers()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<FamilyMemberRow>>(key)
      queryClient.setQueryData<ReadonlyArray<FamilyMemberRow>>(key, prev =>
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.familyMembers() })
    }
  })
}
