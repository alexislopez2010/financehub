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

/**
 * One household member row as returned by `admin_list_household_users`.
 * The RPC returns snake_case columns; we narrow the freeform `role` text
 * column into the union here so callers don't have to.
 */
export interface HouseholdMemberRow {
  user_id: string
  email: string
  display_name: string | null
  role: 'owner' | 'member'
  mfa_factors: number
  joined_at: string
}

export type HouseholdRole = HouseholdMemberRow['role']

/** Runtime narrowing for the freeform text column returned by the RPC. */
function narrowRole(v: unknown): HouseholdRole {
  return v === 'owner' || v === 'member' ? v : 'member'
}

/** Shape of one row before narrowing — what PostgREST hands back. */
interface RawHouseholdMemberRow {
  user_id: string
  email: string | null
  display_name: string | null
  role: string | null
  mfa_factors: number | null
  joined_at: string | null
}

function normalizeRow(r: RawHouseholdMemberRow): HouseholdMemberRow {
  return {
    user_id: r.user_id,
    email: r.email ?? '',
    display_name: r.display_name,
    role: narrowRole(r.role),
    mfa_factors: r.mfa_factors ?? 0,
    joined_at: r.joined_at ?? ''
  }
}

/**
 * Returns every member of the Lopez household. Owners only — the RPC raises
 * on non-owners; the surrounding `/admin` page short-circuits before this
 * query runs so the error path here is a defense-in-depth case (caller is
 * already on a server-gated route).
 *
 * staleTime: 1 minute — admin work is bursty and the page is rarely visited.
 */
export function useHouseholdMembers(): UseQueryResult<ReadonlyArray<HouseholdMemberRow>, Error> {
  return useQuery({
    queryKey: queryKeys.householdMembers(),
    staleTime: 60_000,
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_list_household_users', {
        h_id: LOPEZ_HOUSEHOLD_ID
      })
      if (error) throw error
      const rows = (data ?? []) as ReadonlyArray<RawHouseholdMemberRow>
      return rows.map(normalizeRow)
    }
  })
}

export interface UpdateMemberArgs {
  target_user: string
  patch: { display_name?: string; role?: HouseholdRole }
}

interface MemberListCtx {
  readonly previous: ReadonlyArray<HouseholdMemberRow> | undefined
  readonly key: ReturnType<typeof queryKeys.householdMembers>
}

/**
 * Edits a member's display_name and/or role via `admin_update_household_user`.
 *
 * The RPC's last-owner protection (a trigger on household_members) raises a
 * PG exception when demoting the sole owner; the caller surfaces the message
 * verbatim. Optimistic update applies the patch to the cached list and rolls
 * back on error.
 */
export function useUpdateHouseholdMember(): UseMutationResult<void, Error, UpdateMemberArgs, MemberListCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, UpdateMemberArgs, MemberListCtx>({
    async mutationFn({ target_user, patch }) {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_update_household_user', {
        h_id: LOPEZ_HOUSEHOLD_ID,
        target_user,
        new_role: patch.role ?? null,
        new_display_name: patch.display_name ?? null
      })
      if (error) throw error
    },
    async onMutate({ target_user, patch }) {
      const key = queryKeys.householdMembers()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<HouseholdMemberRow>>(key)
      queryClient.setQueryData<ReadonlyArray<HouseholdMemberRow>>(key, prev =>
        prev
          ? prev.map(r =>
              r.user_id === target_user
                ? {
                    ...r,
                    display_name: patch.display_name ?? r.display_name,
                    role: patch.role ?? r.role
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
      queryClient.invalidateQueries({ queryKey: queryKeys.householdMembers() })
    }
  })
}

export interface ResetMfaArgs {
  target_user: string
}

/**
 * Removes all verified MFA factors for the target user. Returns the count of
 * factors removed (the RPC returns int). No optimistic update: factor counts
 * live in `auth.mfa_factors` not the members cache; we invalidate on settle
 * so the next list fetch shows the updated count.
 */
export function useResetMfa(): UseMutationResult<number, Error, ResetMfaArgs, never> {
  const queryClient = useQueryClient()

  return useMutation<number, Error, ResetMfaArgs, never>({
    async mutationFn({ target_user }) {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('admin_reset_user_mfa', {
        h_id: LOPEZ_HOUSEHOLD_ID,
        target_user
      })
      if (error) throw error
      if (typeof data !== 'number') return 0
      return data
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.householdMembers() })
    }
  })
}

export interface RemoveMemberArgs {
  target_user: string
}

/**
 * Removes a member from the household via `admin_remove_household_user`.
 * The RPC rejects removal of owners (must be demoted first) and self-removal;
 * the dialog disables the action for owner rows so this is the defense-in-depth
 * path. Optimistic drop from cache; rollback on error.
 */
export function useRemoveHouseholdMember(): UseMutationResult<void, Error, RemoveMemberArgs, MemberListCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, RemoveMemberArgs, MemberListCtx>({
    async mutationFn({ target_user }) {
      const supabase = createClient()
      const { error } = await supabase.rpc('admin_remove_household_user', {
        h_id: LOPEZ_HOUSEHOLD_ID,
        target_user
      })
      if (error) throw error
    },
    async onMutate({ target_user }) {
      const key = queryKeys.householdMembers()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<HouseholdMemberRow>>(key)
      queryClient.setQueryData<ReadonlyArray<HouseholdMemberRow>>(key, prev =>
        prev ? prev.filter(r => r.user_id !== target_user) : prev
      )
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.householdMembers() })
    }
  })
}
