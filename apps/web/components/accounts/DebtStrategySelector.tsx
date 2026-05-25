'use client'

import { Snowflake, Mountain, Hand } from 'lucide-react'
import type { PayoffStrategy } from '@/lib/finance/debt'
import { cn } from '@/lib/cn'

export interface DebtStrategySelectorProps {
  value: PayoffStrategy
  onChange: (next: PayoffStrategy) => void
  className?: string
}

const OPTIONS: ReadonlyArray<{
  value: PayoffStrategy
  label: string
  hint: string
  icon: typeof Snowflake
}> = [
  { value: 'snowball',     label: 'Snowball',     hint: 'Pay off smallest balance first', icon: Snowflake },
  { value: 'avalanche',    label: 'Avalanche',    hint: 'Pay off highest APR first',      icon: Mountain  },
  { value: 'minimum_only', label: 'Minimum only', hint: 'No extra; baseline payoff',     icon: Hand      }
]

export function DebtStrategySelector({ value, onChange, className }: DebtStrategySelectorProps) {
  return (
    <div role="radiogroup" aria-label="Payoff strategy" className={cn('grid grid-cols-1 sm:grid-cols-3 gap-2', className)}>
      {OPTIONS.map(o => {
        const Icon = o.icon
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
              active
                ? 'border-brand bg-blue-50/40 text-ink shadow-sm'
                : 'border-rule bg-surface text-muted hover:border-muted/40 hover:text-ink'
            )}
          >
            <div className={cn(
              'flex items-center justify-center w-9 h-9 rounded-md shrink-0',
              active ? 'bg-brand text-white' : 'bg-gray-100 text-muted'
            )}>
              <Icon size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{o.label}</div>
              <div className="text-xs text-muted leading-tight mt-0.5">{o.hint}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
