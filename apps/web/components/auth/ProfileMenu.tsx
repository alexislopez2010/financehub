'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { cn } from '@/lib/cn'

export interface ProfileMenuProps {
  email: string
  className?: string
}

export function ProfileMenu({ email, className }: ProfileMenuProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  // Initials from email local-part (first chars before @).
  const initials = email.split('@')[0]?.slice(0, 2).toUpperCase() ?? '??'

  async function handleSignOut() {
    setSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.refresh()
      router.replace('/login')
    } finally {
      setSigningOut(false)
      setOpen(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          'bg-ink text-bg text-[11px] font-semibold',
          'hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-ink/30'
        )}
      >
        {initials}
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click. */}
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className={cn(
              'absolute right-0 mt-2 w-56 rounded-xl border border-rule bg-bg shadow-lg',
              'z-20 overflow-hidden'
            )}
          >
            <div className="px-4 py-3 border-b border-rule">
              <div className="text-[10px] uppercase tracking-widest text-muted">Signed in as</div>
              <div className="mt-0.5 text-sm font-medium text-ink truncate">{email}</div>
            </div>
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className={cn(
                'block w-full px-4 py-2.5 text-left text-sm text-ink',
                'hover:bg-surface'
              )}
            >
              Admin
            </Link>
            <button
              role="menuitem"
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className={cn(
                'block w-full px-4 py-2.5 text-left text-sm text-ink',
                'hover:bg-surface disabled:opacity-60'
              )}
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
