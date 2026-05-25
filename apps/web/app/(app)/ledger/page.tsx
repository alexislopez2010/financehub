import { Suspense } from 'react'
import { Ledger } from '@/components/ledger/Ledger'

export const metadata = { title: 'Ledger — Lopez Family Finances' }

export default function LedgerPage() {
  return (
    <Suspense>
      <Ledger />
    </Suspense>
  )
}
