import type { LucideIcon } from 'lucide-react'
import { Newspaper, List, Target, Calendar, Wallet } from 'lucide-react'

export interface TabDef {
  /** Stable identifier. */
  key: 'briefing' | 'ledger' | 'plan' | 'bills' | 'accounts'
  /** Route path. */
  href: string
  /** Short label shown beneath the icon on mobile, beside it on desktop. */
  label: string
  icon: LucideIcon
}

export const TABS: ReadonlyArray<TabDef> = [
  { key: 'briefing', href: '/',          label: 'Briefing', icon: Newspaper },
  { key: 'ledger',   href: '/ledger',    label: 'Ledger',   icon: List      },
  { key: 'plan',     href: '/plan',      label: 'Plan',     icon: Target    },
  { key: 'bills',    href: '/bills',     label: 'Bills',    icon: Calendar  },
  { key: 'accounts', href: '/accounts',  label: 'Accounts', icon: Wallet    }
]

/**
 * Active-tab matcher. A tab is active when the current pathname equals its
 * href, OR (for non-root tabs) starts with `href + '/'` (so /ledger/123 still
 * highlights "Ledger"). The root tab "/" only matches exactly.
 */
export function isTabActive(pathname: string, tab: TabDef): boolean {
  if (tab.href === '/') return pathname === '/'
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
}
