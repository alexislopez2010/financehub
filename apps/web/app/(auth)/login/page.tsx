import { Suspense } from 'react'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = {
  title: 'Sign in — Lopez Family Finances'
}

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Headline as="h1" className="text-2xl sm:text-3xl">Sign in</Headline>
        <Standfirst>Email + password. MFA step-up if enrolled.</Standfirst>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  )
}
