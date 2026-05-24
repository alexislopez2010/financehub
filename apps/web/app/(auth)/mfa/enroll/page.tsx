import { Suspense } from 'react'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { MfaEnrollForm } from '@/components/auth/MfaEnrollForm'

export const metadata = { title: 'Enroll MFA — Lopez Family Finances' }

export default function MfaEnrollPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Headline as="h1" className="text-2xl sm:text-3xl">Set up two-factor auth</Headline>
        <Standfirst>
          MFA is required for every session. Set up your authenticator now to continue.
        </Standfirst>
      </div>
      <Suspense>
        <MfaEnrollForm />
      </Suspense>
    </div>
  )
}
