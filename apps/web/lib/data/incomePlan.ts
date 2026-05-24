'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type IncomePlanPeriod } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type IncomePlanRow = Tables<'income_plan'>

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
