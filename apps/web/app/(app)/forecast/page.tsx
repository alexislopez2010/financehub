import { Suspense } from 'react'
import { ForecastSection } from '@/components/forecast/ForecastSection'

export const metadata = { title: 'Forecast — Lopez Family Finances' }

export default function ForecastPage() {
  return (
    <Suspense>
      <ForecastSection />
    </Suspense>
  )
}
