'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import type { Tables } from '@/lib/supabase/database.types'

export type DebtRow = Tables<'debts'>

export const debtsQueryKey = ['debts'] as const

export function useDebts(): UseQueryResult<ReadonlyArray<DebtRow>, Error> {
  return useQuery({
    queryKey: debtsQueryKey,
    staleTime: 5 * 60_000,
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .order('balance', { ascending: true })
      if (error) throw error
      return data ?? []
    }
  })
}
