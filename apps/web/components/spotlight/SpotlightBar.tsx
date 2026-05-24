'use client'

import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSpotlight } from './SpotlightProvider'
import { cn } from '@/lib/cn'

export interface SpotlightBarProps {
  className?: string
  placeholder?: string
}

export function SpotlightBar({
  className,
  placeholder = 'Search or jump…'
}: SpotlightBarProps) {
  const { openSpotlight } = useSpotlight()
  const [isMac, setIsMac] = useState(false)

  useEffect(() => {
    // Detect platform for the keyboard hint. SSR-safe: defaults to "Ctrl" until hydration.
    setIsMac(/Mac|iPod|iPhone|iPad/.test(navigator.platform))
  }, [])

  const shortcut = isMac ? '⌘K' : 'Ctrl K'

  return (
    <button
      type="button"
      onClick={openSpotlight}
      aria-label={`${placeholder} (${shortcut})`}
      className={cn(
        'group flex w-full max-w-md items-center gap-2 rounded-full border border-rule bg-surface px-3 py-1.5',
        'text-left text-sm text-muted',
        'hover:border-muted/40 hover:text-ink transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ink/20',
        className
      )}
    >
      <Search size={14} className="shrink-0 text-muted group-hover:text-ink" aria-hidden="true" />
      <span className="flex-1 italic truncate">{placeholder}</span>
      <kbd className="hidden sm:inline-block shrink-0 rounded border border-rule bg-bg px-1.5 py-0.5 text-[10px] not-italic font-medium text-muted tabular">
        {shortcut}
      </kbd>
    </button>
  )
}
