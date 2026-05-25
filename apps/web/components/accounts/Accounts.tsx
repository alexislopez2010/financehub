'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SectionNav, type AccountsSection as Sec } from './SectionNav'
import { AccountsSection } from './AccountsSection'

function parseSection(v: string | null): Sec {
  if (v === 'debt' || v === 'cfo') return v
  return 'accounts'
}

export function Accounts() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial: Sec = parseSection(searchParams?.get('section') ?? null)

  const [section, setSection] = useState<Sec>(initial)

  useEffect(() => {
    const url = section === 'accounts' ? '/accounts' : `/accounts?section=${section}`
    router.replace(url, { scroll: false })
  }, [section, router])

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Accounts</h1>
          <p className="text-sm text-muted">Balances, debt, and YTD CFO view.</p>
        </div>
        <SectionNav section={section} onChange={setSection} />
      </header>

      {section === 'accounts' && <AccountsSection />}
      {section === 'debt' && (
        <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
          Debt calculator lands in 2J.T2.
        </div>
      )}
      {section === 'cfo' && (
        <div className="bg-surface border border-rule rounded-xl p-8 shadow-sm text-center text-sm text-muted">
          CFO view lands in 2J.T3.
        </div>
      )}
    </div>
  )
}
