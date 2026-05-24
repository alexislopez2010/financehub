import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

export const metadata = { title: 'Forgot password — Lopez Family Finances' }

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Headline as="h1" className="text-2xl sm:text-3xl">Forgot password</Headline>
        <Standfirst>We&apos;ll send a reset link if your email is on the household allowlist.</Standfirst>
      </div>
      <ForgotPasswordForm />
      <p className="text-xs text-muted">
        <a href="/login" className="hover:text-ink">← Back to sign in</a>
      </p>
    </div>
  )
}
