import { cn } from '@/lib/cn'

export interface MastheadProps {
  /** Left-side text, e.g. "VOL. III · BRIEFING" */
  volume: string
  /** Right-side date label, e.g. "SAT, MAY 23" */
  date: string
  className?: string
}

export function Masthead({ volume, date, className }: MastheadProps) {
  return (
    <header
      className={cn(
        'flex items-baseline justify-between border-b border-ink pb-2',
        'text-[10px] uppercase tracking-[0.18em] italic',
        className
      )}
    >
      <span className="text-ink">{volume}</span>
      <span className="text-muted">{date}</span>
    </header>
  )
}
