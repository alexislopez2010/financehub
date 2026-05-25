import { Suspense } from 'react'
import { Bills } from '@/components/bills/Bills'

export const metadata = { title: 'Bills — Lopez Family Finances' }

export default function BillsPage() {
  return (
    <Suspense>
      <Bills />
    </Suspense>
  )
}
