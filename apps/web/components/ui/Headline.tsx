import { cn } from '@/lib/cn'

export interface HeadlineProps {
  children: React.ReactNode
  className?: string
  /** Rendered element. Defaults to h1. */
  as?: 'h1' | 'h2' | 'h3'
}

export function Headline({ children, className, as = 'h1' }: HeadlineProps) {
  const Tag = as
  return (
    <Tag
      className={cn(
        'font-semibold tracking-[-0.01em] leading-[1.05]',
        'text-3xl sm:text-4xl text-ink',
        className
      )}
    >
      {children}
    </Tag>
  )
}
