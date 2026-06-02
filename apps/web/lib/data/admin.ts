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
  /**
   * Application-visible enabled flag. Mirrors `household_members.is_active`.
   * Defaults to true when the table row is missing or the column is null
   * (legacy rows from before migration 0019).
   */
  is_active: boolean
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

function normalizeRow(r: RawHouseholdMemberRow, isActive: boolean): HouseholdMemberRow {
  return {
    user_id: r.user_id,
    email: r.email ?? '',
    display_name: r.display_name,
    role: narrowRole(r.role),
    mfa_factors: r.mfa_factors ?? 0,
    joined_at: r.joined_at ?? '',
    is_active: isActive
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

      // The RPC predates the is_active flag; pull it directly from the
      // household_members table and zip it in by user_id. Owners are
      // already permitted to read the full table via RLS.
      const { data: flagRows, error: flagError } = await supabase
        .from('household_members')
        .select('user_id, is_active')
        .eq('household_id', LOPEZ_HOUSEHOLD_ID)
      if (flagError) throw flagError

      const activeByUserId = new Map<string, boolean>()
      for (const fr of flagRows ?? []) {
        activeByUserId.set(fr.user_id, fr.is_active ?? true)
      }

      return rows.map(r => normalizeRow(r, activeByUserId.get(r.user_id) ?? true))
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

export interface AddHouseholdMemberArgs {
  email: string
  displayName: string
  role: HouseholdRole
}

export interface AddHouseholdMemberResult {
  userId: string
  email: string
  initialPassword: string
  displayName: string
  role: string
}

/** Shape returned by the add-household-member Edge Function. */
interface RawAddMemberResponse {
  user_id?: unknown
  email?: unknown
  initial_password?: unknown
  display_name?: unknown
  role?: unknown
}

function isAddMemberResponse(v: unknown): v is Required<{
  user_id: string
  email: string
  initial_password: string
  display_name: string
  role: string
}> {
  if (!v || typeof v !== 'object') return false
  const r = v as RawAddMemberResponse
  return (
    typeof r.user_id === 'string' &&
    typeof r.email === 'string' &&
    typeof r.initial_password === 'string' &&
    typeof r.display_name === 'string' &&
    typeof r.role === 'string'
  )
}

/**
 * Adds a new member to the Lopez household via the `add-household-member`
 * Edge Function. The Edge Function holds the service-role key and:
 *   - re-verifies the caller is an owner (defense-in-depth on top of the
 *     /admin page gate)
 *   - creates the auth user with auth.admin.createUser
 *   - inserts the household_members row
 *   - rolls back the auth user if the insert fails
 *
 * Returns the new user's id, email, role, display name, and a one-time
 * initial password. The dialog shows the password once with a copy button;
 * it is never persisted client-side.
 */
export function useAddHouseholdMember(): UseMutationResult<
  AddHouseholdMemberResult,
  Error,
  AddHouseholdMemberArgs,
  never
> {
  const queryClient = useQueryClient()

  return useMutation<AddHouseholdMemberResult, Error, AddHouseholdMemberArgs, never>({
    async mutationFn(args) {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('add-household-member', {
        body: {
          household_id: LOPEZ_HOUSEHOLD_ID,
          email: args.email,
          display_name: args.displayName,
          role: args.role
        }
      })
      if (error) throw error
      if (!isAddMemberResponse(data)) {
        throw new Error('add-household-member returned an unexpected response')
      }
      return {
        userId: data.user_id,
        email: data.email,
        initialPassword: data.initial_password,
        displayName: data.display_name,
        role: data.role
      }
    },
    onSuccess() {
      // Refetch the members list so the new row appears.
      void queryClient.invalidateQueries({ queryKey: queryKeys.householdMembers() })
    }
  })
}

export interface ResetMemberPasswordArgs {
  household_id: string
  target_user_id: string
}

export interface ResetMemberPasswordResult {
  email: string
}

/** Shape returned by the reset-household-member-password Edge Function. */
interface RawResetPasswordResponse {
  ok?: unknown
  email?: unknown
}

function isResetPasswordResponse(v: unknown): v is { ok: true; email: string } {
  if (!v || typeof v !== 'object') return false
  const r = v as RawResetPasswordResponse
  return r.ok === true && typeof r.email === 'string'
}

/**
 * Triggers a password-recovery email for the target member via the
 * `reset-household-member-password` Edge Function. The Edge Function holds
 * the service-role key and re-verifies owner status; the caller never sees
 * the recovery link. Returns just the email the link was sent to so the UI
 * can confirm it inline.
 *
 * No optimistic update — nothing in the members cache changes; we only
 * surface the success to the caller. We don't invalidate either: the row
 * data is unaffected by sending a recovery email.
 */
export function useResetHouseholdMemberPassword(): UseMutationResult<
  ResetMemberPasswordResult,
  Error,
  ResetMemberPasswordArgs,
  never
> {
  return useMutation<ResetMemberPasswordResult, Error, ResetMemberPasswordArgs, never>({
    async mutationFn(args) {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('reset-household-member-password', {
        body: {
          household_id: args.household_id,
          target_user_id: args.target_user_id
        }
      })
      if (error) throw error
      if (!isResetPasswordResponse(data)) {
        throw new Error('reset-household-member-password returned an unexpected response')
      }
      return { email: data.email }
    }
  })
}

export interface SetMemberActiveArgs {
  household_id: string
  target_user_id: string
  active: boolean
}

export interface SetMemberActiveResult {
  user_id: string
  active: boolean
}

/** Shape returned by the set-household-member-active Edge Function. */
interface RawSetActiveResponse {
  ok?: unknown
  user_id?: unknown
  active?: unknown
}

function isSetActiveResponse(v: unknown): v is { ok: true; user_id: string; active: boolean } {
  if (!v || typeof v !== 'object') return false
  const r = v as RawSetActiveResponse
  return r.ok === true && typeof r.user_id === 'string' && typeof r.active === 'boolean'
}

/**
 * Toggles a member's `is_active` flag (and the matching auth ban) via the
 * `set-household-member-active` Edge Function. Optimistic update flips the
 * cached row's is_active so the UI updates immediately; rollback on error
 * (the Edge Function rejects self-disable with a 400 the caller surfaces).
 */
export function useSetHouseholdMemberActive(): UseMutationResult<
  SetMemberActiveResult,
  Error,
  SetMemberActiveArgs,
  MemberListCtx
> {
  const queryClient = useQueryClient()

  return useMutation<SetMemberActiveResult, Error, SetMemberActiveArgs, MemberListCtx>({
    async mutationFn(args) {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('set-household-member-active', {
        body: {
          household_id: args.household_id,
          target_user_id: args.target_user_id,
          active: args.active
        }
      })
      if (error) throw error
      if (!isSetActiveResponse(data)) {
        throw new Error('set-household-member-active returned an unexpected response')
      }
      return { user_id: data.user_id, active: data.active }
    },
    async onMutate({ target_user_id, active }) {
      const key = queryKeys.householdMembers()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<HouseholdMemberRow>>(key)
      queryClient.setQueryData<ReadonlyArray<HouseholdMemberRow>>(key, prev =>
        prev
          ? prev.map(r => (r.user_id === target_user_id ? { ...r, is_active: active } : r))
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
