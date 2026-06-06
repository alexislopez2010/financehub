import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { insertImportedTransactions } from './insert'
import type { ImportRow } from './adapters/types'

function makeRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    date: '2026-05-21',
    description: 'TEST DESC',
    amount: -12.34,
    type: 'Expense',
    categoryId: null,
    billId: null,
    fingerprint: 'fp-' + Math.random().toString(36).slice(2, 10),
    source: 'chase',
    ...overrides
  }
}

/**
 * Helper: build a fake SupabaseClient whose `.from('transactions').insert(payload)`
 * resolves with the next queued response. We queue one response per insert call,
 * which lets a single test exercise both a failing batch and the subsequent
 * per-row retries.
 */
interface QueuedResponse {
  error: { message: string } | null
}

function makeFakeSupabase(responses: ReadonlyArray<QueuedResponse>): {
  client: SupabaseClient
  calls: Array<unknown>
} {
  const queue = [...responses]
  const calls: Array<unknown> = []
  const insert = vi.fn((payload: unknown) => {
    calls.push(payload)
    const next = queue.shift() ?? { error: null }
    return Promise.resolve(next)
  })
  const client = {
    from: (_t: string) => ({ insert })
  } as unknown as SupabaseClient
  return { client, calls }
}

describe('insertImportedTransactions', () => {
  it('returns zero inserted + no failures for empty input', async () => {
    const { client } = makeFakeSupabase([])
    const result = await insertImportedTransactions({
      supabase: client,
      rows: [],
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null
    })
    expect(result).toEqual({ inserted: 0, failed: [] })
  })

  it('inserts all rows in a single batch when under CHUNK_SIZE', async () => {
    const rows = [makeRow(), makeRow(), makeRow()]
    // 1 batch call succeeds (no per-row retries).
    const { client, calls } = makeFakeSupabase([{ error: null }])
    const result = await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null
    })
    expect(result.inserted).toBe(3)
    expect(result.failed).toEqual([])
    expect(calls).toHaveLength(1)
    expect(Array.isArray(calls[0])).toBe(true)
    expect((calls[0] as ReadonlyArray<unknown>).length).toBe(3)
  })

  it('falls back to per-row inserts when the batch fails and surfaces mixed results', async () => {
    const rows = [
      makeRow({ description: 'row-0' }),
      makeRow({ description: 'row-1' }),
      makeRow({ description: 'row-2' })
    ]
    // Batch fails, then per-row: row-0 ok, row-1 fails, row-2 ok
    const { client } = makeFakeSupabase([
      { error: { message: 'batch boom' } },
      { error: null },
      { error: { message: 'duplicate fingerprint' } },
      { error: null }
    ])
    const result = await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null
    })
    expect(result.inserted).toBe(2)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]?.error).toBe('duplicate fingerprint')
    expect(result.failed[0]?.row.description).toBe('row-1')
  })

  it('chunks into multiple batches of CHUNK_SIZE and reports progress per batch', async () => {
    const rows = Array.from({ length: 150 }, (_, i) => makeRow({ description: `r-${i}` }))
    // 2 batches both succeed
    const { client } = makeFakeSupabase([{ error: null }, { error: null }])
    const progress: Array<{ done: number; total: number }> = []
    const result = await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null,
      onProgress: (done, total) => progress.push({ done, total })
    })
    expect(result.inserted).toBe(150)
    expect(result.failed).toEqual([])
    expect(progress).toEqual([
      { done: 100, total: 150 },
      { done: 150, total: 150 }
    ])
  })

  it('maps ImportRow fields to the insert payload shape', async () => {
    const row = makeRow({
      date: '2026-04-12',
      description: 'STARBUCKS #4321',
      amount: -5.75,
      type: 'Expense',
      categoryId: 'cat-1',
      fingerprint: 'fp-abc'
    })
    const { client, calls } = makeFakeSupabase([{ error: null }])
    await insertImportedTransactions({
      supabase: client,
      rows: [row],
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null
    })
    const batch = calls[0] as ReadonlyArray<Record<string, unknown>>
    expect(batch[0]).toEqual({
      household_id: 'hh-1',
      date: '2026-04-12',
      description: 'STARBUCKS #4321',
      amount: -5.75,
      type: 'Expense',
      account: 'Chase Checking',
      account_id: 'acc-1',
      category_id: 'cat-1',
      // category text is null because no categoryById was passed; the
      // dedicated test below covers the resolution path.
      category: null,
      fingerprint: 'fp-abc',
      member: null
    })
  })

  it('writes member=null on every row when member arg is null', async () => {
    const rows = [
      makeRow({ description: 'row-a' }),
      makeRow({ description: 'row-b' }),
      makeRow({ description: 'row-c' })
    ]
    const { client, calls } = makeFakeSupabase([{ error: null }])
    await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null
    })
    const batch = calls[0] as ReadonlyArray<Record<string, unknown>>
    expect(batch).toHaveLength(3)
    for (const row of batch) {
      expect(row.member).toBeNull()
    }
  })

  it('writes member="Alexis Lopez" on every row when member arg is provided', async () => {
    const rows = [
      makeRow({ description: 'row-a' }),
      makeRow({ description: 'row-b' }),
      makeRow({ description: 'row-c' })
    ]
    const { client, calls } = makeFakeSupabase([{ error: null }])
    await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: 'Alexis Lopez'
    })
    const batch = calls[0] as ReadonlyArray<Record<string, unknown>>
    expect(batch).toHaveLength(3)
    for (const row of batch) {
      expect(row.member).toBe('Alexis Lopez')
    }
  })

  it('resolves category name from categoryById and writes both category + category_id', async () => {
    // Regression: prior implementation set only category_id on insert,
    // leaving category text null. spendByCategory + deriveBudgetVsActual
    // bucket on the text field, so auto-categorized-at-import rows showed
    // up as Uncategorized forever.
    const rows = [
      makeRow({ description: 'mapped',   categoryId: 'cat-1' }),
      makeRow({ description: 'unmapped', categoryId: null    })
    ]
    const { client, calls } = makeFakeSupabase([{ error: null }])
    await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null,
      categoryById: new Map([['cat-1', 'Groceries']])
    })
    const payload = calls[0] as ReadonlyArray<Record<string, unknown>>
    expect(payload).toHaveLength(2)
    expect(payload[0]).toMatchObject({ category_id: 'cat-1', category: 'Groceries' })
    expect(payload[1]).toMatchObject({ category_id: null,    category: null })
  })

  it('still sets category to null when categoryById is omitted (back-compat)', async () => {
    const rows = [makeRow({ categoryId: 'cat-orphan' })]
    const { client, calls } = makeFakeSupabase([{ error: null }])
    await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: null
    })
    const payload = calls[0] as ReadonlyArray<Record<string, unknown>>
    // category_id still written; category text null because the lookup
    // map is empty (orphan FK is the caller's responsibility to clean up).
    expect(payload[0]).toMatchObject({ category_id: 'cat-orphan', category: null })
  })

  it('preserves member arg when falling back to per-row inserts', async () => {
    const rows = [makeRow({ description: 'row-0' }), makeRow({ description: 'row-1' })]
    const { client, calls } = makeFakeSupabase([
      { error: { message: 'batch boom' } },
      { error: null },
      { error: null }
    ])
    await insertImportedTransactions({
      supabase: client,
      rows,
      householdId: 'hh-1',
      accountId: 'acc-1',
      accountName: 'Chase Checking',
      member: 'Family'
    })
    // First call = the bulk batch payload; subsequent calls = per-row payloads.
    expect(calls).toHaveLength(3)
    const perRowA = calls[1] as Record<string, unknown>
    const perRowB = calls[2] as Record<string, unknown>
    expect(perRowA.member).toBe('Family')
    expect(perRowB.member).toBe('Family')
  })
})
