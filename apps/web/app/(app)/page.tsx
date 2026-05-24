import { createClient } from '@/lib/supabase/server'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'

export const metadata = { title: 'Briefing — Lopez Family Finances' }

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="space-y-8">
      <SectionLabel>Briefing — placeholder</SectionLabel>
      <Headline>Authenticated.</Headline>
      <Standfirst>
        Signed in as <span className="not-italic font-medium">{user?.email}</span>.
        The real Briefing surface lands in Phase 2F.
      </Standfirst>
      <div className="mt-12 rounded-xl border border-rule bg-surface p-6 text-sm text-muted">
        <p>
          This page exists only to confirm the auth + middleware + (app) shell pipeline
          works end-to-end. Visiting any route here when signed out should redirect to
          <code className="px-1 mx-1 rounded bg-bg border border-rule">/login</code>.
          MFA challenge happens automatically when required.
        </p>
      </div>
    </div>
  )
}
