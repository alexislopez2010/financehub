import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'

export const metadata = { title: 'Accounts — Lopez Family Finances' }

export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <SectionLabel>Accounts — placeholder</SectionLabel>
      <Headline>Balances &amp; debt</Headline>
      <Standfirst>
        Account list with balances, the debt payoff calculator, the CFO
        summary, and (in Phase 3) net worth over time using the
        account_balances snapshot table.
      </Standfirst>
    </div>
  )
}
