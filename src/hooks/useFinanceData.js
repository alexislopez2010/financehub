import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetches all transactions and bills for the current user's household.
 * RLS on the server guarantees the user only sees rows for households
 * they belong to, so we don't have to pass a household_id.
 */
export function useFinanceData() {
  const [transactions, setTransactions] = useState([])
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Ensure current user is linked to the Lopez household (no-op if already a member).
      // Safe to call on every load: the RPC is idempotent and fast.
      await supabase.rpc('claim_lopez_household')
      const [txRes, billRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('bills').select('*').order('name', { ascending: true }),
      ])
      if (txRes.error) throw txRes.error
      if (billRes.error) throw billRes.error
      setTransactions(txRes.data || [])
      setBills(billRes.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return { transactions, bills, loading, error, reload: load }
}
