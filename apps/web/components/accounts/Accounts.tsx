'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SectionNav, type AccountsSection as Sec } from './SectionNav'
import { AccountsSection } from './AccountsSection'
import { DebtSection } from './DebtSection'
import { CfoSection } from './CfoSection'

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
      {section === 'debt' && <DebtSection />}
      {section === 'cfo' && <CfoSection />}
    </div>
  )
}
