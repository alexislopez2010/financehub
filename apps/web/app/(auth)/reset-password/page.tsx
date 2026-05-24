import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = { title: 'Reset password — Lopez Family Finances' }

export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Headline as="h1" className="text-2xl sm:text-3xl">Set a new password</Headline>
        <Standfirst>At least 12 characters. You&apos;ll need to sign in again afterward.</Standfirst>
      </div>
      <ResetPasswordForm />
    </div>
  )
}
