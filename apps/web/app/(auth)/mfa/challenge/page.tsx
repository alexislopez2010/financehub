import { Suspense } from 'react'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { MfaChallengeForm } from '@/components/auth/MfaChallengeForm'

export const metadata = { title: 'Verify MFA — Lopez Family Finances' }

export default function MfaChallengePage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Headline as="h1" className="text-2xl sm:text-3xl">Verify your code</Headline>
        <Standfirst>Open your authenticator app and enter the 6-digit code.</Standfirst>
      </div>
      <Suspense>
        <MfaChallengeForm />
      </Suspense>
    </div>
  )
}
