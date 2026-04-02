import { cn } from '@/lib/utils'

interface ProgressProps {
  value: number
  max?: number
  className?: string
  indicatorClassName?: string
}

export function Progress({ value, max = 100, className, indicatorClassName }: ProgressProps) {
  const percent = Math.min((value / max) * 100, 100)
  const isOver = value > max

  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          isOver ? 'bg-destructive' : percent > 80 ? 'bg-warning' : 'bg-primary',
          indicatorClassName
        )}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  )
}
