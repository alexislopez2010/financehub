'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type BudgetPeriod } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type BudgetRow = Tables<'budgets'>

export function useBudgets(period: BudgetPeriod): UseQueryResult<ReadonlyArray<BudgetRow>, Error> {
  return useQuery({
    queryKey: queryKeys.budgets(period),
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('year', period.year)
        .eq('month', period.month)
        .order('category')
      if (error) throw error
      return data ?? []
    }
  })
}
