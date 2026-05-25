import { Suspense } from 'react'
import { Plan } from '@/components/plan/Plan'

export const metadata = { title: 'Plan — Lopez Family Finances' }

export default function PlanPage() {
  return (
    <Suspense>
      <Plan />
    </Suspense>
  )
}
