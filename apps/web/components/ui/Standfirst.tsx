import { cn } from '@/lib/cn'

export interface StandfirstProps {
  children: React.ReactNode
  className?: string
}

export function Standfirst({ children, className }: StandfirstProps) {
  return (
    <p
      className={cn(
        'italic text-[15px] leading-relaxed text-muted',
        className
      )}
    >
      {children}
    </p>
  )
}
