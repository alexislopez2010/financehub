import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Fetches accounts + current balances for the user's household.
 * RLS handles scoping; no household_id needed.
 */
export function useAccounts() {
  const [accounts, setAccounts] = useState([])
  const [balances, setBalances] = useState({}) // { account_id: current_balance }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [acctRes, balRes] = await Promise.all([
        supabase.from('accounts').select('*').order('display_order', { ascending: true }).order('name', { ascending: true }),
        supabase.from('v_account_current_balance').select('account_id, current_balance, as_of_date'),
      ])
      if (acctRes.error) throw acctRes.error
      // balance view may be empty on first run; non-fatal
      const bMap = {}
      if (!balRes.error && balRes.data) {
        for (const row of balRes.data) {
          bMap[row.account_id] = { balance: Number(row.current_balance), as_of: row.as_of_date }
        }
      }
      setAccounts(acctRes.data || [])
      setBalances(bMap)
    } catch (e) {
      setError(e.message || 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const createAccount = async (fields) => {
    const { error } = await supabase.from('accounts').insert(fields)
    if (error) throw error
    await load()
  }

  const updateAccount = async (id, fields) => {
    const { error } = await supabase.from('accounts').update(fields).eq('id', id)
    if (error) throw error
    await load()
  }

  const archiveAccount = async (id) => {
    const { error } = await supabase.from('accounts').update({ archived_at: new Date().toISOString(), is_active: false }).eq('id', id)
    if (error) throw error
    await load()
  }

  const unarchiveAccount = async (id) => {
    const { error } = await supabase.from('accounts').update({ archived_at: null, is_active: true }).eq('id', id)
    if (error) throw error
    await load()
  }

  return { accounts, balances, loading, error, reload: load, createAccount, updateAccount, archiveAccount, unarchiveAccount }
}
