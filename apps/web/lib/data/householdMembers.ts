'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'

/**
 * One row of the household_members table as fetched by the non-admin
 * `useHouseholdMembersList` hook. Distinct from the richer
 * `HouseholdMemberRow` in `./admin.ts` which carries email + mfa_factors
 * via the owner-gated RPC.
 */
export interface HouseholdMemberListRow {
  user_id: string
  display_name: string
  role: 'owner' | 'member'
}

/** Runtime narrowing for the freeform text role column. */
function narrowRole(v: unknown): HouseholdMemberListRow['role'] {
  return v === 'owner' || v === 'member' ? v : 'member'
}

interface RawRow {
  user_id: string
  display_name: string | null
  role: string | null
}

function normalizeRow(r: RawRow): HouseholdMemberListRow {
  return {
    user_id: r.user_id,
    display_name: r.display_name ?? '',
    role: narrowRole(r.role)
  }
}

/**
 * Non-admin hook. Returns all members of the Lopez household via a direct
 * SELECT under the existing `view own memberships` RLS policy (any
 * household member can see the roster). Distinct from
 * `useHouseholdMembers` in `./admin.ts`, which uses an owner-gated RPC
 * with email + MFA factor columns intended for the /admin surface.
 *
 * staleTime: 5 minutes — roster rarely changes; this is consumed per-row
 * in Ledger so a long stale window matters.
 */
export function useHouseholdMembersList(): UseQueryResult<
  ReadonlyArray<HouseholdMemberListRow>,
  Error
> {
  return useQuery({
    queryKey: ['household_members_list', LOPEZ_HOUSEHOLD_ID] as const,
    staleTime: 5 * 60_000,
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('household_members')
        .select('user_id, display_name, role')
        .eq('household_id', LOPEZ_HOUSEHOLD_ID)
        .order('display_name', { ascending: true })
      if (error) throw error
      const rows = (data ?? []) as ReadonlyArray<RawRow>
      return rows.map(normalizeRow)
    }
  })
}
