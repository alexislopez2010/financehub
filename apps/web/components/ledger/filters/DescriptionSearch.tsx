'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface DescriptionSearchProps {
  value: string
  onChange: (next: string) => void
  className?: string
}

const DEBOUNCE_MS = 200

export function DescriptionSearch({ value, onChange, className }: DescriptionSearchProps) {
  const [draft, setDraft] = useState(value)

  // Debounce: emit onChange after the draft has been still for DEBOUNCE_MS.
  useEffect(() => {
    if (draft === value) return
    const id = setTimeout(() => onChange(draft), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [draft, onChange, value])

  // Sync from external value (URL navigation, reset, etc.) without
  // depending on `draft` to avoid loops.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <div className={cn('relative w-full sm:w-[240px]', className)}>
      <Search
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
      <input
        type="search"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder="Search descriptions…"
        aria-label="Search descriptions"
        className={cn(
          'w-full pl-9 pr-8 py-1.5 text-sm rounded-lg',
          'bg-surface border border-rule text-ink',
          'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/20'
        )}
      />
      {draft.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setDraft('')
            onChange('')
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
