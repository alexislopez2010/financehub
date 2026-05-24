import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'

export const metadata = { title: 'Signups disabled — Lopez Family Finances' }

export default function SignupPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Headline as="h1" className="text-2xl sm:text-3xl">Signups disabled</Headline>
        <Standfirst>
          New accounts are invite-only. Ask a household owner to add your email to
          the allowlist, then check your inbox for the Supabase invite.
        </Standfirst>
      </div>
      <p className="text-xs text-muted">
        <a href="/login" className="hover:text-ink">← Back to sign in</a>
      </p>
    </div>
  )
}
