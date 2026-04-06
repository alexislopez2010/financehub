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
  const [budgets, setBudgets] = useState([])
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [familyMembers, setFamilyMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Ensure current user is linked to the Lopez household (no-op if already a member).
      // Safe to call on every load: the RPC is idempotent and fast.
      await supabase.rpc('claim_lopez_household')
      const [txRes, billRes, budgetRes, debtRes, accRes, famRes] = await Promise.all([
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('bills').select('*').order('name', { ascending: true }),
        supabase.from('budgets').select('*').order('category', { ascending: true }),
        supabase.from('debts').select('*').order('balance', { ascending: false }),
        supabase.from('accounts').select('*').order('name', { ascending: true }),
        supabase.from('family_members').select('*').order('name', { ascending: true }),
      ])
      if (txRes.error) throw txRes.error
      if (billRes.error) throw billRes.error
      if (budgetRes.error) throw budgetRes.error
      if (debtRes.error) throw debtRes.error
      if (accRes.error) throw accRes.error
      if (famRes.error) throw famRes.error
      setTransactions(txRes.data || [])
      setBills(billRes.data || [])
      setBudgets(budgetRes.data || [])
      setDebts(debtRes.data || [])
      setAccounts(accRes.data || [])
      setFamilyMembers(famRes.data || [])
    } catch (e) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Optimistic local patch for a single transaction (used after inline edits)
  const patchTransaction = (id, patch) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  // Delete a bill (soft-delete: sets is_active = false)
  const removeBill = async (id) => {
    const { error: err } = await supabase.from('bills').update({ is_active: false }).eq('id', id)
    if (err) throw err
    setBills(prev => prev.map(b => b.id === id ? { ...b, is_active: false } : b))
  }

  // Hard-delete a bill row entirely
  const deleteBill = async (id) => {
    const { error: err } = await supabase.from('bills').delete().eq('id', id)
    if (err) throw err
    setBills(prev => prev.filter(b => b.id !== id))
  }

  // Create a new bill (e.g. promoted from a transaction)
  const createBill = async (bill) => {
    const { data, error: err } = await supabase.from('bills').insert(bill).select().single()
    if (err) throw err
    setBills(prev => [...prev, data].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
    return data
  }

  return { transactions, bills, budgets, debts, accounts, familyMembers, loading, error, reload: load, patchTransaction, removeBill, deleteBill, createBill }
}
