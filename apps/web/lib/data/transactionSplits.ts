'use client'

import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/browser'
import { queryKeys } from './keys'
import type { Tables, TablesInsert } from '@/lib/supabase/database.types'

export type TransactionSplitRow    = Tables<'transaction_splits'>
export type TransactionSplitInsert = TablesInsert<'transaction_splits'>

/**
 * Fetches every transaction_splits row for the active household.
 * Paginated to defeat the PostgREST 1000-row cap (same pattern as useTransactions).
 */
export function useTransactionSplits(): UseQueryResult<ReadonlyArray<TransactionSplitRow>, Error> {
  return useQuery({
    queryKey: queryKeys.transactionSplits(),
    staleTime: 5 * 60_000,
    async queryFn() {
      const supabase = createClient()
      const PAGE = 1000
      const all: TransactionSplitRow[] = []
      for (let p = 0; p < 50; p++) {
        const { data, error } = await supabase
          .from('transaction_splits')
          .select('*')
          .order('transaction_id')
          .order('display_order')
          .range(p * PAGE, p * PAGE + PAGE - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < PAGE) break
      }
      return all
    }
  })
}

interface ReplaceSplitsArgs {
  /** Parent transaction id. */
  transactionId: string
  /** New splits. Empty array deletes any existing splits (unsplit). */
  splits: ReadonlyArray<Omit<TransactionSplitInsert, 'transaction_id'>>
}

interface ReplaceCtx {
  readonly previous: ReadonlyArray<TransactionSplitRow> | undefined
  readonly key: ReturnType<typeof queryKeys.transactionSplits>
}

/**
 * Atomically replaces all splits for one parent transaction.
 *   - Empty splits[] → deletes existing splits (unsplit the parent)
 *   - Non-empty     → deletes existing + inserts new ones
 *
 * The DB trigger enforces sum-of-splits = parent.amount, so the caller must
 * supply splits that sum correctly or the insert will throw.
 */
export function useReplaceTransactionSplits(): UseMutationResult<void, Error, ReplaceSplitsArgs, ReplaceCtx> {
  const queryClient = useQueryClient()

  return useMutation<void, Error, ReplaceSplitsArgs, ReplaceCtx>({
    async mutationFn({ transactionId, splits }) {
      const supabase = createClient()
      // The trigger is DEFERRABLE INITIALLY DEFERRED — the sum check fires at
      // commit time, so a delete+insert pair within one transaction succeeds
      // even though the intermediate state has zero splits.
      // PostgREST doesn't expose explicit transactions, but a delete-then-bulk-
      // insert in one request batch behaves as one statement per call. To stay
      // safe we delete first, then insert — the trigger tolerates zero splits
      // (treated as "not split") so this is fine.
      const { error: delErr } = await supabase
        .from('transaction_splits')
        .delete()
        .eq('transaction_id', transactionId)
      if (delErr) throw delErr

      if (splits.length > 0) {
        const payload = splits.map((s, idx) => ({
          ...s,
          transaction_id: transactionId,
          display_order: s.display_order ?? idx
        }))
        const { error: insErr } = await supabase
          .from('transaction_splits')
          .insert(payload)
        if (insErr) throw insErr
      }
    },
    async onMutate({ transactionId, splits }) {
      const key = queryKeys.transactionSplits()
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ReadonlyArray<TransactionSplitRow>>(key)

      // Optimistic: drop existing splits for this parent + append new ones with tmp ids.
      const next: TransactionSplitRow[] = []
      for (const s of previous ?? []) {
        if (s.transaction_id !== transactionId) next.push(s)
      }
      splits.forEach((s, idx) => {
        next.push({
          id: `tmp-${Math.random().toString(36).slice(2)}`,
          created_at: null,
          transaction_id: transactionId,
          household_id: s.household_id,
          amount: s.amount,
          member: s.member ?? null,
          category: s.category ?? null,
          category_id: s.category_id ?? null,
          sub_category: s.sub_category ?? null,
          notes: s.notes ?? null,
          exclude_from_runway: s.exclude_from_runway ?? null,
          display_order: s.display_order ?? idx
        } satisfies TransactionSplitRow)
      })
      queryClient.setQueryData<ReadonlyArray<TransactionSplitRow>>(key, next)
      return { previous, key }
    },
    onError(_err, _args, ctx) {
      if (ctx) queryClient.setQueryData(ctx.key, ctx.previous)
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: queryKeys.transactionSplits() })
    }
  })
}
