'use client'

import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/data/keys'
import {
  searchEverything,
  type SpotlightHit,
  type TransactionRow,
  type BillRow,
  type AccountRow,
  type CategoryRow
} from './search'

export interface SpotlightSearchResult {
  readonly hits: ReadonlyArray<SpotlightHit>
  readonly groups: {
    readonly transactions: ReadonlyArray<SpotlightHit>
    readonly bills: ReadonlyArray<SpotlightHit>
    readonly accounts: ReadonlyArray<SpotlightHit>
    readonly categories: ReadonlyArray<SpotlightHit>
  }
  readonly isEmpty: boolean
}

const EMPTY_TX: ReadonlyArray<TransactionRow> = []
const EMPTY_BILLS: ReadonlyArray<BillRow> = []
const EMPTY_ACCOUNTS: ReadonlyArray<AccountRow> = []
const EMPTY_CATEGORIES: ReadonlyArray<CategoryRow> = []
const EMPTY_HITS: ReadonlyArray<SpotlightHit> = []

const EMPTY_RESULT: SpotlightSearchResult = {
  hits: EMPTY_HITS,
  groups: {
    transactions: EMPTY_HITS,
    bills: EMPTY_HITS,
    accounts: EMPTY_HITS,
    categories: EMPTY_HITS
  },
  isEmpty: true
}

interface CorpusSnapshot {
  readonly transactions: ReadonlyArray<TransactionRow>
  readonly bills: ReadonlyArray<BillRow>
  readonly accounts: ReadonlyArray<AccountRow>
  readonly categories: ReadonlyArray<CategoryRow>
}

const EMPTY_CORPUS: CorpusSnapshot = {
  transactions: EMPTY_TX,
  bills: EMPTY_BILLS,
  accounts: EMPTY_ACCOUNTS,
  categories: EMPTY_CATEGORIES
}

const EMPTY_CORPUS_SNAPSHOT: CorpusSnapshot = EMPTY_CORPUS

function getServerSnapshot(): CorpusSnapshot {
  return EMPTY_CORPUS_SNAPSHOT
}

/**
 * Reads the four spotlight corpus slots from TanStack Query and returns the
 * scored, grouped hits for `query`.
 *
 * Pure cache reader: never invokes useQuery or fetchQuery — this hook must
 * not trigger network traffic. Missing slots fall back to empty arrays.
 *
 * Subscription strategy: useSyncExternalStore wired to the query cache.
 * A per-instance cached snapshot makes getSnapshot referentially stable
 * when the four underlying slot references haven't changed, which is what
 * useSyncExternalStore requires to bail out of re-renders.
 */
export function useSpotlightSearch(query: string): SpotlightSearchResult {
  const queryClient = useQueryClient()
  const corpus = useCorpusSnapshot(queryClient)

  return useMemo<SpotlightSearchResult>(() => {
    if (query.trim() === '') return EMPTY_RESULT

    const hits = searchEverything(corpus, query)
    if (hits.length === 0) return EMPTY_RESULT

    return {
      hits,
      groups: {
        transactions: hits.filter(h => h.kind === 'transaction'),
        bills: hits.filter(h => h.kind === 'bill'),
        accounts: hits.filter(h => h.kind === 'account'),
        categories: hits.filter(h => h.kind === 'category')
      },
      isEmpty: false
    }
  }, [query, corpus])
}

interface SnapshotCache {
  tx: ReadonlyArray<TransactionRow> | undefined
  bills: ReadonlyArray<BillRow> | undefined
  accounts: ReadonlyArray<AccountRow> | undefined
  categories: ReadonlyArray<CategoryRow> | undefined
  snapshot: CorpusSnapshot
  primed: boolean
}

function useCorpusSnapshot(queryClient: QueryClient): CorpusSnapshot {
  const cacheRef = useRef<SnapshotCache>({
    tx: undefined,
    bills: undefined,
    accounts: undefined,
    categories: undefined,
    snapshot: EMPTY_CORPUS,
    primed: false
  })

  const subscribe = useCallback(
    (notify: () => void) => {
      return queryClient.getQueryCache().subscribe(() => notify())
    },
    [queryClient]
  )

  const getSnapshot = useCallback(
    () => readCorpus(queryClient, cacheRef.current),
    [queryClient]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function readCorpus(
  queryClient: QueryClient,
  cache: SnapshotCache
): CorpusSnapshot {
  const tx = queryClient.getQueryData<ReadonlyArray<TransactionRow>>(
    queryKeys.transactions()
  )
  const bills = queryClient.getQueryData<ReadonlyArray<BillRow>>(
    queryKeys.bills()
  )
  const accounts = queryClient.getQueryData<ReadonlyArray<AccountRow>>(
    queryKeys.accounts()
  )
  const categories = queryClient.getQueryData<ReadonlyArray<CategoryRow>>(
    queryKeys.categories()
  )

  if (
    cache.primed &&
    cache.tx === tx &&
    cache.bills === bills &&
    cache.accounts === accounts &&
    cache.categories === categories
  ) {
    return cache.snapshot
  }

  cache.tx = tx
  cache.bills = bills
  cache.accounts = accounts
  cache.categories = categories
  cache.primed = true
  cache.snapshot = {
    transactions: tx ?? EMPTY_TX,
    bills: bills ?? EMPTY_BILLS,
    accounts: accounts ?? EMPTY_ACCOUNTS,
    categories: categories ?? EMPTY_CATEGORIES
  }
  return cache.snapshot
}
