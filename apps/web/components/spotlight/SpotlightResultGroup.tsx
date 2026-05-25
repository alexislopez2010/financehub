'use client'

import { Command } from 'cmdk'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import type { SpotlightHit } from '@/lib/spotlight/search'
import { cn } from '@/lib/cn'

export interface SpotlightResultGroupProps {
  heading: string
  hits: ReadonlyArray<SpotlightHit>
  Icon: LucideIcon
  onSelect: (hit: SpotlightHit) => void
}

export function SpotlightResultGroup({ heading, hits, Icon, onSelect }: SpotlightResultGroupProps) {
  if (hits.length === 0) return null

  return (
    <Command.Group
      heading={heading}
      className={cn(
        '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:mt-2',
        '[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase',
        '[&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:italic',
        '[&_[cmdk-group-heading]]:text-muted'
      )}
    >
      {hits.map(hit => (
        <Command.Item
          key={`${hit.kind}-${hit.id}`}
          value={`${hit.kind} ${hit.label} ${hit.id}`}
          onSelect={() => onSelect(hit)}
          className={cn(
            'group flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-ink mx-2',
            'aria-selected:bg-surface'
          )}
        >
          <Icon size={14} className="shrink-0 text-muted group-aria-selected:text-ink" aria-hidden="true" />
          <span className="truncate">{hit.label}</span>
          {hit.detail !== undefined && (
            <span className="ml-auto hidden sm:inline-block shrink-0 text-xs text-muted tabular">
              {hit.detail}
            </span>
          )}
          <ArrowRight
            size={12}
            className={cn(
              'text-muted opacity-0 group-aria-selected:opacity-100',
              hit.detail !== undefined ? 'ml-2 sm:ml-0' : 'ml-auto'
            )}
            aria-hidden="true"
          />
        </Command.Item>
      ))}
    </Command.Group>
  )
}
