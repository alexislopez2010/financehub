'use client'

import { Wallet, CreditCard, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type AccountsSection = 'accounts' | 'debt' | 'cfo'

export interface SectionNavProps {
  section: AccountsSection
  onChange: (s: AccountsSection) => void
  className?: string
}

const TABS: ReadonlyArray<{ value: AccountsSection; label: string; icon: typeof Wallet }> = [
  { value: 'accounts', label: 'Accounts', icon: Wallet },
  { value: 'debt',     label: 'Debt',     icon: CreditCard },
  { value: 'cfo',      label: 'CFO View', icon: BarChart3 }
]

export function SectionNav({ section, onChange, className }: SectionNavProps) {
  return (
    <nav
      aria-label="Accounts sections"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100',
        className
      )}
    >
      {TABS.map(t => {
        const Icon = t.icon
        const active = section === t.value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
              active
                ? 'bg-white text-ink shadow-sm font-medium'
                : 'text-muted hover:text-ink'
            )}
          >
            <Icon size={14} />
            <span>{t.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
