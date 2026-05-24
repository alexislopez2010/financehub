import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileMenu } from '@/components/auth/ProfileMenu'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Middleware enforces auth — this is belt-and-suspenders.
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="border-b border-rule">
        <div className="mx-auto max-w-5xl px-5 py-3 flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.18em] italic text-muted">
            LOPEZ FAMILY · FINANCES
          </div>
          <ProfileMenu email={user.email ?? '(no email)'} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 flex-1">
        {children}
      </main>
    </div>
  )
}
