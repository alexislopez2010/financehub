'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type BillRow = Tables<'bills'>

export function useBills(): UseQueryResult<ReadonlyArray<BillRow>, Error> {
  return useQuery({
    queryKey: queryKeys.bills(),
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .order('due_day', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data ?? []
    }
  })
}
