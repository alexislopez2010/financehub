import { cn } from '@/lib/cn'

export interface SectionLabelProps {
  children: React.ReactNode
  className?: string
}

export function SectionLabel({ children, className }: SectionLabelProps) {
  return (
    <div
      className={cn(
        'text-[10px] uppercase tracking-[0.18em] italic text-muted',
        className
      )}
    >
      {children}
    </div>
  )
}
