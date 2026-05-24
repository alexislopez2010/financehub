import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'

export const metadata = { title: 'Ledger — Lopez Family Finances' }

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <SectionLabel>Ledger — placeholder</SectionLabel>
      <Headline>Transactions</Headline>
      <Standfirst>
        Mobile-first sticky-month list with inline edit, bulk select, and
        promote-to-bill lands in Phase 2G.
      </Standfirst>
    </div>
  )
}
