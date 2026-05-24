'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export interface SpotlightContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  openSpotlight: () => void
  closeSpotlight: () => void
}

const SpotlightContext = createContext<SpotlightContextValue | null>(null)

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const openSpotlight = useCallback(() => setOpen(true), [])
  const closeSpotlight = useCallback(() => setOpen(false), [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd-K (Mac) or Ctrl-K (Win/Linux) toggles open.
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const value = useMemo<SpotlightContextValue>(
    () => ({ open, setOpen, openSpotlight, closeSpotlight }),
    [open, openSpotlight, closeSpotlight]
  )

  return <SpotlightContext.Provider value={value}>{children}</SpotlightContext.Provider>
}

export function useSpotlight(): SpotlightContextValue {
  const ctx = useContext(SpotlightContext)
  if (!ctx) {
    throw new Error('useSpotlight must be used inside <SpotlightProvider>')
  }
  return ctx
}
