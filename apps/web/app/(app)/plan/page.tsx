import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'

export const metadata = { title: 'Plan — Lopez Family Finances' }

export default function PlanPage() {
  return (
    <div className="space-y-6">
      <SectionLabel>Plan — placeholder</SectionLabel>
      <Headline>Budget &amp; income</Headline>
      <Standfirst>
        Budget vs actual + income plan vs actual, both keyed on the new
        category_id FK, land in Phase 2H.
      </Standfirst>
    </div>
  )
}
