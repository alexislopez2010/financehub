import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const LOPEZ_HOUSEHOLD_ID = '00000000-0000-0000-0000-000000000001'

/**
 * Returns true if the current auth user is an owner of the Lopez household.
 * Used to gate the Admin tab.
 */
export function useIsOwner() {
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { if (alive) { setIsOwner(false); setLoading(false) } ; return }
        const { data, error } = await supabase
          .from('household_members')
          .select('role')
          .eq('household_id', LOPEZ_HOUSEHOLD_ID)
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (alive) setIsOwner(data?.role === 'owner')
      } catch {
        if (alive) setIsOwner(false)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return { isOwner, loading, householdId: LOPEZ_HOUSEHOLD_ID }
}
