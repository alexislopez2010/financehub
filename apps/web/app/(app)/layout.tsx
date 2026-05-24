import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileMenu } from '@/components/auth/ProfileMenu'
import { TabBar } from '@/components/nav/TabBar'
import { SpotlightProvider } from '@/components/spotlight/SpotlightProvider'
import { SpotlightBar } from '@/components/spotlight/SpotlightBar'
import { SpotlightDialog } from '@/components/spotlight/SpotlightDialog'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <SpotlightProvider>
      <div className="min-h-screen flex flex-col bg-bg">
        <header
          role="banner"
          className="sticky top-0 z-20 border-b border-rule bg-bg/85 backdrop-blur"
        >
          <div className="mx-auto max-w-5xl px-4 sm:px-5 py-2.5 flex items-center gap-3">
            <div className="hidden sm:block shrink-0 text-[10px] uppercase tracking-[0.18em] italic text-muted">
              LOPEZ FAMILY
            </div>
            <div className="flex-1 min-w-0">
              <SpotlightBar />
            </div>
            <ProfileMenu email={user.email ?? '(no email)'} />
          </div>
          <div className="hidden md:block">
            <div className="mx-auto max-w-5xl px-5 pb-2">
              <TabBar variant="inline" />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 sm:px-5 py-6 sm:py-8 flex-1 pb-24 md:pb-8">
          {children}
        </main>

        <div className="md:hidden">
          <TabBar variant="bottom" />
        </div>

        <SpotlightDialog />
      </div>
    </SpotlightProvider>
  )
}
