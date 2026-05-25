import { Suspense } from 'react'
import { Accounts } from '@/components/accounts/Accounts'

export const metadata = { title: 'Accounts — Lopez Family Finances' }

export default function AccountsPage() {
  return (
    <Suspense>
      <Accounts />
    </Suspense>
  )
}
