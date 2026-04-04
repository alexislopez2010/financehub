import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Edit2, Check, X } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'

const fmtUSD = (n) => (n == null || isNaN(n))
  ? '—'
  : (n < 0
      ? `-$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
      : `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`)

// Signed delta applied to balance for each transaction type.
function txDelta(t) {
  const amt = Number(t.amount) || 0
  switch (t.type) {
    case 'Income':
    case 'Refund':   return amt
    case 'Expense':  return -amt
    case 'Transfer': return amt // sign of amount encodes direction
    default:         return 0
  }
}

const TYPE_COLOR = {
  Income:   'text-emerald-700 bg-emerald-50',
  Refund:   'text-emerald-700 bg-emerald-50',
  Expense:  'text-red-700 bg-red-50',
  Transfer: 'text-blue-700 bg-blue-50',
}

export default function AccountDetail({ account, onBack }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editCategory, setEditCategory] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('account_id', account.id)
        .order('date', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      setTransactions(data || [])
    } catch (e) {
      setError(e.message || 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [account.id])

  // Compute running balance oldest → newest, then reverse for display.
  const rowsDesc = useMemo(() => {
    const start = Number(account.starting_balance) || 0
    let running = start
    const rows = transactions.map(t => {
      running = running + txDelta(t)
      return { ...t, running_balance: running }
    })
    return rows.slice().reverse()
  }, [transactions, account.starting_balance])

  const currentBalance = rowsDesc.length > 0 ? rowsDesc[0].running_balance : (Number(account.starting_balance) || 0)

  // Distinct categories from this account's transactions, for the datalist.
  const categoryOptions = useMemo(() => {
    const s = new Set()
    for (const t of transactions) if (t.category) s.add(t.category)
    return Array.from(s).sort()
  }, [transactions])

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditCategory(t.category || '')
    setEditNotes(t.notes || '')
  }
  const cancelEdit = () => { setEditingId(null); setEditCategory(''); setEditNotes('') }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ category: editCategory.trim() || null, notes: editNotes.trim() || null })
        .eq('id', id)
      if (error) throw error
      setTransactions(prev => prev.map(t => t.id === id
        ? { ...t, category: editCategory.trim() || null, notes: editNotes.trim() || null }
        : t))
      cancelEdit()
    } catch (e) {
      alert('Save failed: ' + (e.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300">
          <ArrowLeft size={14}/> Accounts
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">{account.name}</h2>
          <p className="text-xs text-gray-500 truncate">
            {account.type}{account.institution ? ` · ${account.institution}` : ''}{account.last_four ? ` · ···${account.last_four}` : ''}
          </p>
        </div>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Current balance" value={fmtUSD(currentBalance)} accent="text-gray-900" />
        <SummaryCard label="Starting balance" value={fmtUSD(Number(account.starting_balance) || 0)} accent="text-gray-700" />
        <SummaryCard label="Transactions" value={transactions.length.toLocaleString()} accent="text-gray-700" />
      </div>

      {/* Transactions */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading transactions…</div>
      ) : error ? (
        <div className="text-center text-red-600 py-12">Error: {error}</div>
      ) : rowsDesc.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          No transactions linked to this account yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  <th className="text-left px-3 py-2">Description</th>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Type</th>
                  <th className="text-right px-3 py-2">Amount</th>
                  <th className="text-right px-3 py-2">Balance</th>
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rowsDesc.map(t => {
                  const isEditing = editingId === t.id
                  const delta = txDelta(t)
                  return (
                    <Fragment key={t.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{t.date}</td>
                        <td className="px-3 py-2 text-gray-900 min-w-[200px]">
                          <div className="truncate max-w-xs" title={t.description}>{t.description}</div>
                          {t.notes && !isEditing && <div className="text-[11px] text-gray-500 italic truncate max-w-xs" title={t.notes}>{t.notes}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">{t.category || <span className="text-gray-400">—</span>}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TYPE_COLOR[t.type] || 'bg-gray-100 text-gray-700'}`}>{t.type}</span>
                        </td>
                        <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {delta < 0 ? '-' : '+'}{fmtUSD(Math.abs(Number(t.amount) || 0)).replace('-','')}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">{fmtUSD(t.running_balance)}</td>
                        <td className="px-2 py-2">
                          {!isEditing && (
                            <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="Edit category/notes">
                              <Edit2 size={13}/>
                            </button>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={7} className="px-3 py-3">
                            <div className="flex flex-col md:flex-row gap-2 md:items-end">
                              <label className="flex-1">
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Category</span>
                                <input
                                  list="category-options"
                                  type="text"
                                  value={editCategory}
                                  onChange={e => setEditCategory(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="e.g. Groceries"
                                  autoFocus
                                />
                              </label>
                              <label className="flex-[2]">
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Notes</span>
                                <input
                                  type="text"
                                  value={editNotes}
                                  onChange={e => setEditNotes(e.target.value)}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                  placeholder="Optional notes"
                                />
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveEdit(t.id)}
                                  disabled={saving}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
                                >
                                  <Check size={13}/> Save
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  disabled={saving}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
                                >
                                  <X size={13}/> Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <datalist id="category-options">
        {categoryOptions.map(c => <option key={c} value={c} />)}
      </datalist>
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 md:p-4 shadow-sm">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{label}</div>
      <div className={`text-base md:text-xl font-bold mt-1 ${accent}`}>{value}</div>
    </div>
  )
}
