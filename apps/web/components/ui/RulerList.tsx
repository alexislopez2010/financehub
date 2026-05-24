import { cn } from '@/lib/cn'

export interface RulerListItem {
  /** Left-side label content (string or JSX). */
  label: React.ReactNode
  /** Right-side value (typically a formatted number). */
  value: React.ReactNode
  /** Stable key for the list. */
  key: string
}

export interface RulerListProps {
  items: ReadonlyArray<RulerListItem>
  className?: string
}

export function RulerList({ items, className }: RulerListProps) {
  return (
    <ul className={cn('text-[13px] leading-6', className)}>
      {items.map((item, i) => (
        <li
          key={item.key}
          className={cn(
            'flex justify-between gap-3 py-1',
            i < items.length - 1 && 'border-b border-dotted border-rule'
          )}
        >
          <span className="truncate">{item.label}</span>
          <span className="tabular font-medium shrink-0">{item.value}</span>
        </li>
      ))}
    </ul>
  )
}
