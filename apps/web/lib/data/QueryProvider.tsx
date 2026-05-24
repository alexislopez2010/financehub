'use client'

import { useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

/**
 * Per-request QueryClient (per Next.js + TanStack guidance).
 * useState ensures a single client per browser tab — not recreated on rerender —
 * and never shared across users (each session gets its own React tree).
 *
 * Defaults:
 *   - staleTime 30s — most reads in the app are interactive and we want
 *     fresh-ish data on tab refocus.
 *   - retry 1 — once on transient errors; failure surfaces fast.
 *   - refetchOnWindowFocus is enabled by default (TanStack default).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true
          },
          mutations: {
            retry: 0
          }
        }
      })
  )

  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV !== 'production' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  )
}
