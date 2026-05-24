# Phase 2E — TanStack Query data layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Wire TanStack Query into `apps/web` and build typed query + mutation hooks for every per-household data type. After 2E every surface (2F–2J) has a uniform, cached, optimistically-updated data layer to consume.

**Architecture:** Single `QueryClient` mounted at the `(app)` layout. One query-key file (`lib/data/keys.ts`) consolidates the key conventions. One file per data type in `lib/data/` exporting `useX()`, `useCreateX()`, `useUpdateX()`, `useDeleteX()` hooks. All hooks call the browser Supabase client. Mutations use optimistic updates with cache-snapshot rollback on error. URL state for surface-specific filtering lives in each surface (not in the shared data layer).

**Tech Stack:** `@tanstack/react-query`, `@tanstack/react-query-devtools` (dev only), generated Supabase types via `supabase gen types typescript`, the existing `lib/supabase/browser.ts`.

---

## File structure (target end-state of 2E)

```
apps/web/
├── lib/
│   ├── supabase/
│   │   ├── browser.ts             (existing)
│   │   ├── server.ts              (existing)
│   │   ├── middleware.ts          (existing)
│   │   └── database.types.ts      NEW — generated from Supabase
│   └── data/
│       ├── QueryProvider.tsx      QueryClient + provider for (app) layout
│       ├── keys.ts                consolidated query key factory
│       ├── transactions.ts        useTransactions + create/update/delete
│       ├── bills.ts               useBills + mutations
│       ├── budgets.ts             useBudgets + mutations
│       ├── accounts.ts            useAccounts + mutations (mostly read-only for now)
│       ├── categories.ts          useCategories + mutations
│       ├── incomePlan.ts          useIncomePlan + mutations
│       ├── billMatchRules.ts      useBillMatchRules + mutations
│       └── *.test.ts              query-key tests + selected mutation tests
└── app/(app)/layout.tsx           wire QueryProvider into the shell
```

The `lib/finance/` modules from 2D consume data via plain function arguments; they don't import anything from `lib/data/`. The surfaces are the layer that calls hooks then passes their output into `lib/finance/*` functions.

---

## Task list

| # | Task | Files |
|---|---|---|
| 1 | Install `@tanstack/react-query` + devtools. Drop the pre-generated `database.types.ts` (provided by controller). Build `QueryProvider` and `keys.ts`. Mount the provider in `(app)/layout.tsx`. | `apps/web/lib/data/QueryProvider.tsx`, `keys.ts`, `apps/web/lib/supabase/database.types.ts`, `apps/web/app/(app)/layout.tsx`, `package.json` |
| 2 | Read hooks for all 7 data types: `useTransactions(filters?)`, `useBills`, `useBudgets({year,month})`, `useAccounts`, `useCategories`, `useIncomePlan({year})`, `useBillMatchRules`. Each is a thin `useQuery` over a typed Supabase select. | `lib/data/{transactions,bills,budgets,accounts,categories,incomePlan,billMatchRules}.ts` (read portion only) |
| 3 | Mutation hooks for transactions (create/update/delete) with optimistic updates + rollback. Tests for the optimistic flow using a wrapped QueryClient + mocked Supabase. | `lib/data/transactions.ts` (mutations) + tests |
| 4 | Mutation hooks for the rest (bills, budgets, categories, incomePlan, billMatchRules). Accounts: skip mutations for now — Phase 2J Admin surface handles those. | corresponding `lib/data/*.ts` files |
| 5 | Coverage check on `lib/data/keys.ts` (the only thing easily unit-testable without a real DB). Confirm typecheck + lint + build green. Commit final state. | none new |

---

## Query key conventions

```ts
export const queryKeys = {
  transactions: (filters?: TransactionFilters) =>
    filters === undefined
      ? (['transactions'] as const)
      : (['transactions', filters] as const),
  bills: () => ['bills'] as const,
  budgets: (period: { year: number; month: number }) => ['budgets', period] as const,
  accounts: () => ['accounts'] as const,
  categories: () => ['categories'] as const,
  incomePlan: (period: { year: number }) => ['incomePlan', period] as const,
  billMatchRules: () => ['billMatchRules'] as const
}
```

Stale time: 30 seconds for transactions/bills/budgets, 5 minutes for categories/accounts (rarely change).

## Mutation optimistic-update pattern

```ts
useMutation({
  async mutationFn(payload) {
    const { data, error } = await supabase.from('transactions').insert(payload).select().single()
    if (error) throw error
    return data
  },
  async onMutate(payload) {
    const key = queryKeys.transactions()
    await queryClient.cancelQueries({ queryKey: key })
    const prev = queryClient.getQueryData(key)
    queryClient.setQueryData(key, /* append optimistic row */)
    return { prev, key }
  },
  onError(_err, _payload, ctx) {
    if (ctx) queryClient.setQueryData(ctx.key, ctx.prev)
  },
  onSettled() {
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions() })
  }
})
```

---

## Success criteria

- All 7 data types have a read hook + (where in scope) full CRUD mutation hooks
- Hooks correctly use the Supabase browser client (`createClient()` from `lib/supabase/browser.ts`)
- `QueryProvider` mounted in `(app)/layout.tsx`; devtools shown in development only
- Mutation tests for at least transactions prove the optimistic + rollback path
- `lib/data/keys.ts` is 100% covered
- All previous tests still pass (219 Vitest + 12 Playwright)
- Typecheck + lint + build clean

---

## Out of scope

- Type-generation tooling automation (we generate once via MCP; can re-gen later)
- Surface-specific URL state (lives in the surface)
- Pagination (transactions table is small enough today; revisit when it's not)
- Real-time subscriptions
