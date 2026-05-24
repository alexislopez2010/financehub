import { cn } from '@/lib/cn'

export interface KpiStoneProps {
  /** Small uppercase label, e.g. "CASH" */
  label: string
  /** Big formatted value, e.g. "$42,180" */
  value: string
  /** Optional caption below, e.g. "+$620" */
  caption?: string
  /** Tone of the caption — drives color. */
  tone?: 'neutral' | 'positive' | 'negative'
  className?: string
}

const toneClass: Record<NonNullable<KpiStoneProps['tone']>, string> = {
  neutral: 'text-muted',
  positive: 'text-accent',
  negative: 'text-warn'
}

export function KpiStone({ label, value, caption, tone = 'neutral', className }: KpiStoneProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</div>
      <div className="text-lg font-semibold tabular text-ink tracking-[-0.01em]">
        {value}
      </div>
      {caption !== undefined && (
        <div className={cn('text-[10px] italic', toneClass[tone])}>
          {caption}
        </div>
      )}
    </div>
  )
}
