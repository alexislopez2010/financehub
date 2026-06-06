import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export type IconTone = 'emerald' | 'red' | 'purple' | 'blue' | 'amber' | 'gray'
export type CaptionTone = 'positive' | 'negative' | 'neutral'

export interface KpiTileProps {
  label: string
  value: string
  caption?: string
  captionTone?: CaptionTone
  icon?: LucideIcon
  iconTone?: IconTone
  className?: string
  /**
   * When supplied, the tile becomes a button that calls onClick. Used by
   * the Briefing to open a per-KPI breakdown drawer so the user can see
   * which accounts / transactions / inputs roll up to the displayed
   * number.
   */
  onClick?: () => void
  /**
   * Active state — applied when the tile's drawer is open. Lights up the
   * border + background so the user sees which drawer belongs to which
   * tile after scrolling down.
   */
  active?: boolean
}

const iconToneClasses: Record<IconTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  red:     'bg-red-50 text-red-600',
  purple:  'bg-purple-50 text-purple-600',
  blue:    'bg-blue-50 text-blue-600',
  amber:   'bg-amber-50 text-amber-600',
  gray:    'bg-gray-100 text-gray-600'
}

const captionToneClasses: Record<CaptionTone, string> = {
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  neutral:  'text-gray-500'
}

const captionArrow: Record<CaptionTone, string> = {
  positive: '↗',
  negative: '↘',
  neutral:  ''
}

export function KpiTile({
  label, value, caption, captionTone = 'neutral',
  icon: Icon, iconTone = 'gray', className, onClick, active
}: KpiTileProps) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active === true : undefined}
      className={cn(
        'bg-surface border rounded-xl p-5 shadow-sm flex flex-col gap-3 text-left',
        onClick && 'cursor-pointer hover:border-ink/30 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-brand/40',
        active ? 'border-brand ring-2 ring-brand/20' : 'border-rule',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] font-semibold text-muted">
          {label}
        </div>
        {Icon && (
          <div className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg',
            iconToneClasses[iconTone]
          )}>
            <Icon size={18} strokeWidth={2} />
          </div>
        )}
      </div>
      {/* whitespace-nowrap: KPI values are atomic — never let the browser
          break a number across lines (e.g., "−" hanging on its own row
          above "$2,013" because the Unicode minus is a break opportunity). */}
      <div className="text-3xl font-bold text-ink tabular tracking-tight whitespace-nowrap">{value}</div>
      {caption && (
        <div className={cn('text-xs', captionToneClasses[captionTone])}>
          {captionArrow[captionTone] && (
            <span className="mr-1">{captionArrow[captionTone]}</span>
          )}
          {caption}
        </div>
      )}
    </Wrapper>
  )
}
