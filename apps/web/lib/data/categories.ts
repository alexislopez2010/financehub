'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type CategoryRow = Tables<'categories'>

export function useCategories(): UseQueryResult<ReadonlyArray<CategoryRow>, Error> {
  return useQuery({
    queryKey: queryKeys.categories(),
    staleTime: 5 * 60_000,
    async queryFn() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type', { ascending: false })  // 'income' before 'expense' alphabetically actually 'expense' first; use parent_category secondary
        .order('parent_category', { ascending: true, nullsFirst: true })
        .order('name')
      if (error) throw error
      return data ?? []
    }
  })
}
