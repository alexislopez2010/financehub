import type { ReactNode } from 'react'
import { Masthead } from '@/components/ui/Masthead'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="mx-auto w-full max-w-md pt-8 px-5">
        <Masthead volume="LOPEZ FAMILY · FINANCES" date="Private dashboard" />
      </header>
      <main className="mx-auto w-full max-w-md px-5 pt-10 pb-12 flex-1">
        {children}
      </main>
    </div>
  )
}
