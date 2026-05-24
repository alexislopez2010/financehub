'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { TABS, isTabActive, type TabDef } from './tabs'
import { cn } from '@/lib/cn'

export interface TabBarProps {
  variant: 'bottom' | 'inline'
  className?: string
}

export function TabBar({ variant, className }: TabBarProps) {
  const pathname = usePathname() ?? '/'

  if (variant === 'bottom') {
    return (
      <nav
        aria-label="Primary"
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-bg',
          'pb-[env(safe-area-inset-bottom)]',
          className
        )}
      >
        <ul className="grid grid-cols-5 mx-auto max-w-xl">
          {TABS.map(tab => (
            <TabItem key={tab.key} tab={tab} active={isTabActive(pathname, tab)} variant="bottom" />
          ))}
        </ul>
      </nav>
    )
  }

  return (
    <nav aria-label="Primary" className={cn('flex', className)}>
      <ul className="flex items-center gap-1">
        {TABS.map(tab => (
          <TabItem key={tab.key} tab={tab} active={isTabActive(pathname, tab)} variant="inline" />
        ))}
      </ul>
    </nav>
  )
}

function TabItem({
  tab,
  active,
  variant
}: {
  tab: TabDef
  active: boolean
  variant: 'bottom' | 'inline'
}) {
  const Icon = tab.icon

  if (variant === 'bottom') {
    return (
      <li>
        <Link
          href={tab.href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] uppercase tracking-[0.12em]',
            active ? 'text-ink' : 'text-muted hover:text-ink'
          )}
        >
          <Icon size={18} strokeWidth={active ? 2 : 1.5} />
          <span>{tab.label}</span>
        </Link>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs uppercase tracking-[0.12em]',
          active
            ? 'text-ink bg-surface'
            : 'text-muted hover:text-ink hover:bg-surface/60'
        )}
      >
        <Icon size={14} strokeWidth={active ? 2 : 1.5} />
        <span>{tab.label}</span>
      </Link>
    </li>
  )
}
