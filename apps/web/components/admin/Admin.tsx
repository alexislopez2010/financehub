'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AdminSectionNav, type AdminSection } from './AdminSectionNav'
import { MembersSection } from './members/MembersSection'
import { CategoriesSection } from './categories/CategoriesSection'
import { RulesSection } from './rules/RulesSection'

function parseSection(v: string | null): AdminSection {
  if (v === 'categories' || v === 'rules') return v
  return 'members'
}

export function Admin() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initial: AdminSection = parseSection(searchParams?.get('section') ?? null)

  const [section, setSection] = useState<AdminSection>(initial)

  useEffect(() => {
    const current = searchParams?.get('section') ?? null
    // Don't replace URL when our state already matches the URL.
    if (section === 'members' && current === null) return
    if (current === section) return
    const url = section === 'members' ? '/admin' : `/admin?section=${section}`
    router.replace(url, { scroll: false })
  }, [section, searchParams, router])

  return (
    <div className="space-y-4 pb-4">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Admin</h1>
          <p className="text-sm text-muted">Household members, categories, and match rules.</p>
        </div>
        <AdminSectionNav section={section} onChange={setSection} />
      </header>

      {section === 'members' && <MembersSection />}
      {section === 'categories' && <CategoriesSection />}
      {section === 'rules' && <RulesSection />}
    </div>
  )
}
