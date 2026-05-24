'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type BillMatchRuleRow = Tables<'bill_match_rules'>

export function useBillMatchRules(): UseQueryResult<ReadonlyArray<BillMatchRuleRow>, Error> {
  return useQuery({
    queryKey: queryKeys.billMatchRules(),
    staleTime: 5 * 60_000,  // rules rarely change
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bill_match_rules')
        .select('*')
      if (error) throw error
      return data ?? []
    }
  })
}
