'use client'

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { TablesInsert } from '@/lib/supabase/database.types'
import type { SeasonalProfile } from '@/lib/forecast/seasonalProfile'

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

export interface AnalyzeHistoryArgs {
  billName: string
  rawText: string
}

export interface AnalyzeHistoryResult {
  profile: SeasonalProfile
  /** How many of the 12 calendar months had observed history. */
  monthsCovered: number
  /** How many observations the model returned after validation. */
  observationsUsed: number
  /** Non-fatal notes from distillation (e.g. months filled from the average). */
  warnings: string[]
  /** Model-authored one-line summary. */
  note: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Sends one bill's raw history to the server route, which calls Claude to
 * extract per-month observations and then distills them into a verified
 * SeasonalProfile. Raw text is never persisted — only the returned profile,
 * which the caller writes to bills.seasonal_profile after the user confirms.
 */
export function useAnalyzeBillHistory(): UseMutationResult<AnalyzeHistoryResult, Error, AnalyzeHistoryArgs, unknown> {
  return useMutation<AnalyzeHistoryResult, Error, AnalyzeHistoryArgs, unknown>({
    async mutationFn(args) {
      const res = await fetch('/api/forecast/analyze-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      })
      const json: unknown = await res.json().catch(() => null)
      if (!res.ok || !json || typeof json !== 'object' || (json as { ok?: unknown }).ok !== true) {
        const message = json && typeof json === 'object' && typeof (json as { error?: unknown }).error === 'string'
          ? (json as { error: string }).error
          : `Request failed (${res.status}).`
        throw new Error(message)
      }
      const data = json as { ok: true } & AnalyzeHistoryResult
      return {
        profile: data.profile,
        monthsCovered: data.monthsCovered,
        observationsUsed: data.observationsUsed,
        warnings: data.warnings,
        note: data.note,
        confidence: data.confidence
      }
    }
  })
}
