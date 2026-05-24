import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'

export const metadata = { title: 'Bills — Lopez Family Finances' }

export default function BillsPage() {
  return (
    <div className="space-y-6">
      <SectionLabel>Bills — placeholder</SectionLabel>
      <Headline>Recurring obligations</Headline>
      <Standfirst>
        Reads from the bill_match_rules table seeded in Phase 1. Each row will
        link to its matched transactions. Implementation lands in Phase 2I.
      </Standfirst>
    </div>
  )
}
