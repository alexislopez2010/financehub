import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileMenu } from '@/components/auth/ProfileMenu'
import { TabBar } from '@/components/nav/TabBar'
import { QueryProvider } from '@/lib/data/QueryProvider'
import { SpotlightProvider } from '@/components/spotlight/SpotlightProvider'
import { SpotlightBar } from '@/components/spotlight/SpotlightBar'
import { SpotlightDialog } from '@/components/spotlight/SpotlightDialog'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Force-reset gate: when an admin used set-household-member-password on
  // this user, every (app) route bounces to /reset-password until the user
  // picks a fresh password and calls clear_must_reset_password(). We check
  // here (not in middleware) so the lookup runs only on real navigations,
  // not on every static asset request. A failure to read the flag is
  // tolerated — we'd rather let the user in than lock everyone out if RLS
  // momentarily misbehaves.
  const { data: forceResetRows } = await supabase
    .from('household_members')
    .select('must_reset_password')
    .eq('user_id', user.id)
  const mustReset = (forceResetRows ?? []).some(r => r.must_reset_password === true)
  if (mustReset) {
    redirect('/reset-password?forced=1')
  }

  return (
    <QueryProvider>
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
    </QueryProvider>
  )
}
