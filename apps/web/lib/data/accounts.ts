'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type AccountRow = Tables<'accounts'>

export function useAccounts(): UseQueryResult<ReadonlyArray<AccountRow>, Error> {
  return useQuery({
    queryKey: queryKeys.accounts(),
    staleTime: 5 * 60_000,  // accounts rarely change
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('name')
      if (error) throw error
      return data ?? []
    }
  })
}
