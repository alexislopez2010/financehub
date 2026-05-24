import { createClient } from '@/lib/supabase/server'
import { Masthead } from '@/components/ui/Masthead'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'

export const metadata = { title: 'Briefing — Lopez Family Finances' }

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).toUpperCase()
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const today = formatToday()

  return (
    <article className="space-y-8">
      <Masthead volume="VOL. III · BRIEFING" date={today} />

      <div className="space-y-3 pt-2">
        <SectionLabel>Briefing — placeholder</SectionLabel>
        <Headline>Authenticated.</Headline>
        <Standfirst>
          Signed in as <span className="not-italic font-medium">{user?.email}</span>.
          The real Briefing surface (KPI stones, coming-due list, 30-day forecast,
          notable callouts) lands in Phase 2F.
        </Standfirst>
      </div>

      <div className="rounded-xl border border-rule bg-surface p-5 sm:p-6 text-sm text-muted">
        <p>
          This page exists only to confirm the auth + middleware + (app) shell
          pipeline works end-to-end. Try the bottom tabs (mobile) or the inline
          tabs in the header (desktop). Press <kbd className="px-1 mx-1 rounded border border-rule bg-bg text-[10px] tabular">⌘K</kbd>
          (or <kbd className="px-1 mx-1 rounded border border-rule bg-bg text-[10px] tabular">Ctrl K</kbd>) to open
          the spotlight palette.
        </p>
      </div>
    </article>
  )
}
