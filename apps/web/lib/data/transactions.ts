'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys, type TransactionFilters } from './keys'
import type { Tables } from '@/lib/supabase/database.types'

export type TransactionRow = Tables<'transactions'>

/**
 * Returns transactions for the active household, optionally filtered.
 * Default order: date descending, then created_at descending (stable when
 * multiple txs share a date).
 */
export function useTransactions(
  filters?: TransactionFilters
): UseQueryResult<ReadonlyArray<TransactionRow>, Error> {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    async queryFn() {
      const supabase = createClient()
      let q = supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (filters?.startDate) q = q.gte('date', filters.startDate)
      if (filters?.endDate) q = q.lte('date', filters.endDate)
      if (filters?.categoryId !== undefined) {
        q = filters.categoryId === null
          ? q.is('category_id', null)
          : q.eq('category_id', filters.categoryId)
      }
      if (filters?.account) q = q.eq('account', filters.account)
      if (filters?.member) q = q.eq('member', filters.member)
      if (filters?.type) q = q.eq('type', filters.type)

      const { data, error } = await q
      if (error) throw error
      return data ?? []
    }
  })
}
