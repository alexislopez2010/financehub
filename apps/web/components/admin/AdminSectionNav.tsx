'use client'

import { Users, Tag, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'

export type AdminSection = 'members' | 'categories' | 'rules'

export interface AdminSectionNavProps {
  section: AdminSection
  onChange: (s: AdminSection) => void
  className?: string
}

const TABS: ReadonlyArray<{ value: AdminSection; label: string; icon: typeof Users }> = [
  { value: 'members',    label: 'Members',     icon: Users },
  { value: 'categories', label: 'Categories',  icon: Tag },
  { value: 'rules',      label: 'Match rules', icon: Sparkles }
]

export function AdminSectionNav({ section, onChange, className }: AdminSectionNavProps) {
  return (
    <nav
      aria-label="Admin sections"
      className={cn(
        'inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 overflow-x-auto',
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
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap',
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
