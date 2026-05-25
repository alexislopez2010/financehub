import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { Admin } from '@/components/admin/Admin'

export const metadata = { title: 'Admin — Lopez Family Finances' }

function AdminSkeleton() {
  return (
    <div className="px-4 py-12 text-center text-sm text-muted">Loading…</div>
  )
}

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin')
  }

  // Fail closed on DB error — but log so transient failures are visible in server logs.
  const { data: membership, error: membershipError } = await supabase
    .from('household_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('household_id', LOPEZ_HOUSEHOLD_ID)
    .maybeSingle()

  if (membershipError) {
    console.error('Admin owner check failed:', membershipError.message)
    redirect('/')
  }

  if (!membership || membership.role !== 'owner') {
    redirect('/')
  }

  return (
    <Suspense fallback={<AdminSkeleton />}>
      <Admin />
    </Suspense>
  )
}
