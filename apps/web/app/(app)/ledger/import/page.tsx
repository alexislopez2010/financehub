import { Suspense } from 'react'
import { ImportFlow } from '@/components/ledger/import/ImportFlow'

export const metadata = { title: 'Import transactions — Lopez Family Finances' }

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="text-sm italic text-muted">Loading…</p>}>
      <ImportFlow />
    </Suspense>
  )
}
