'use client'

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { TablesInsert } from '@/lib/supabase/database.types'

export type BudgetInsert = TablesInsert<'budgets'>

export interface ApplyBudgetsArgs {
  /** Target period the proposals write to. */
  year: number
  month: number
  /** Existing budget rows to update in place: id + the new amount. */
  updates: ReadonlyArray<{ id: string; amount: number }>
  /** New budget rows to insert (already carrying household_id, category[_id], year, month). */
  inserts: ReadonlyArray<BudgetInsert>
}

/**
 * Applies forecast budget proposals for one target month: updates existing
 * budget rows in place and inserts new ones, then invalidates that period so
 * the Plan + Forecast surfaces refresh. The caller (ProposeBudgetsPanel) splits
 * proposals into updates vs inserts using the current budget rows.
 *
 * Updates run sequentially and are NOT wrapped in a transaction. A mid-batch
 * failure leaves earlier rows applied — but that is self-healing here: onSettled
 * invalidates the period, the panel refetches, and proposeBudgets re-derives the
 * diff from the actual rows, so already-applied categories show a zero delta and
 * drop out while the failed ones remain selectable for a retry. Acceptable for a
 * single-household app; revisit with a transactional RPC if this becomes shared.
 */
export function useApplyBudgets(): UseMutationResult<void, Error, ApplyBudgetsArgs, unknown> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, ApplyBudgetsArgs, unknown>({
    async mutationFn({ updates, inserts }) {
      const supabase = createClient()

      for (const u of updates) {
        const { error } = await supabase
          .from('budgets')
          .update({ amount: u.amount })
          .eq('id', u.id)
        if (error) throw error
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('budgets').insert([...inserts])
        if (error) throw error
      }
    },
    onSettled(_data, _err, args) {
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets({ year: args.year, month: args.month }) })
    }
  })
}
