import { Fragment, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Edit2, Check, X, Search, ArrowUpRight } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useCategoryTaxonomy } from '../../hooks/useCategoryTaxonomy.js'

const fmtUSD = (n) => (n == null || isNaN(n))
  ? '—'
  : (n < 0
      ? `-$${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`
      : `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`)

// Signed delta applied to balance for each transaction type.
// For liability accounts (credit cards, loans), the balance represents
// amount owed, so charges add and payments subtract (opposite of assets).
function txDelta(t, accountType) {
  const amt = Number(t.amount) || 0
  const isLiability = accountType === 'credit' || accountType === 'loan'
  if (isLiability) {
    switch (t.type) {
      case 'Income':   return -amt  // payment received → debt down
      case 'Refund':   return -amt  // return → debt down
      case 'Expense':  return amt   // charge → debt up
      case 'Transfer': return -amt  // signed; inbound (+) reduces debt
      default:         return 0
    }
  }
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
  const [editSubCategory, setEditSubCategory] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  // Promote-to-bill state
  const [promoteTarget, setPromoteTarget] = useState(null)
  const [promoteName, setPromoteName] = useState('')
  const [promoteCategory, setPromoteCategory] = useState('')
  const [promoteFrequency, setPromoteFrequency] = useState('Monthly')
  const [promoteAmount, setPromoteAmount] = useState('')
  const [promoteDueDay, setPromoteDueDay] = useState('')
  const [promoteAccount, setPromoteAccount] = useState('')
  const [promoteSaving, setPromoteSaving] = useState(false)
  const [promoteError, setPromoteError] = useState('')
  const startPromote = (t) => {
    setPromoteTarget(t)
    setPromoteName(t.description?.substring(0, 60) || '')
    setPromoteCategory(t.sub_category || t.category || '')
    setPromoteFrequency('Monthly')
    setPromoteAmount(String(Number(t.amount) || 0))
    setPromoteDueDay(t.date ? String(new Date(t.date + 'T12:00:00').getDate()) : '')
    setPromoteAccount(account.name || '')
    setPromoteError('')
  }
  const cancelPromote = () => { setPromoteTarget(null); setPromoteError('') }
  const submitPromote = async () => {
    if (!promoteName.trim()) { setPromoteError('Bill name is required'); return }
    if (!promoteAmount || Number(promoteAmount) <= 0) { setPromoteError('Amount must be > 0'); return }
    setPromoteSaving(true)
    try {
      const { error: err } = await supabase.from('bills').insert({
        household_id: account.household_id || '00000000-0000-0000-0000-000000000001',
        name: promoteName.trim(),
        category: promoteCategory || null,
        account: promoteAccount || null,
        frequency: promoteFrequency,
        budget_amount: Number(promoteAmount),
        due_day: promoteDueDay ? Number(promoteDueDay) : null,
        is_active: true,
      })
      if (err) throw err
      setPromoteTarget(null)
    } catch (e) {
      setPromoteError(e.message || 'Failed to create bill')
    } finally {
      setPromoteSaving(false)
    }
  }

  const { tree: catTree, categories: catList } = useCategoryTaxonomy()
  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'date' || col === 'amount' || col === 'running_balance' ? 'desc' : 'asc' })
  const sortIcon = (col) => sort.col !== col ? null : <span className="text-[9px] ml-0.5">{sort.dir === 'asc' ? '▲' : '▼'}</span>

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
      running = running + txDelta(t, account.type)
      return { ...t, running_balance: running }
    })
    return rows.slice().reverse()
  }, [transactions, account.starting_balance, account.type])

  const currentBalance = rowsDesc.length > 0 ? rowsDesc[0].running_balance : (Number(account.starting_balance) || 0)

  // Apply search + type filter + sort on top of rowsDesc (running_balance is preserved per row)
  const displayRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rowsDesc
    if (q) {
      out = out.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.sub_category || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q) ||
        (t.member || '').toLowerCase().includes(q)
      )
    }
    if (typeFilter !== 'all') out = out.filter(t => t.type === typeFilter)
    const mult = sort.dir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      const av = a[sort.col] ?? ''
      const bv = b[sort.col] ?? ''
      if (sort.col === 'amount' || sort.col === 'running_balance') return (Number(av) - Number(bv)) * mult
      return String(av).localeCompare(String(bv)) * mult
    })
    return out
  }, [rowsDesc, search, typeFilter, sort])

  // Sub-categories available for the currently-selected Category (cascades).
  const subCatOptions = useMemo(() => {
    if (!editCategory) return []
    return catTree[editCategory] || []
  }, [editCategory, catTree])

  const startEdit = (t) => {
    setEditingId(t.id)
    setEditCategory(t.category || '')
    setEditSubCategory(t.sub_category || '')
    setEditNotes(t.notes || '')
  }
  const cancelEdit = () => {
    setEditingId(null); setEditCategory(''); setEditSubCategory(''); setEditNotes('')
  }

  const saveEdit = async (id) => {
    setSaving(true)
    try {
      const patch = {
        category:     editCategory || null,
        sub_category: editSubCategory || null,
        notes:        editNotes.trim() || null,
      }
      const { error } = await supabase
        .from('transactions')
        .update(patch)
        .eq('id', id)
      if (error) throw error
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
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
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 flex-wrap">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search description, category, notes…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            >
              <option value="all">All types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
              <option value="Refund">Refund</option>
              <option value="Transfer">Transfer</option>
            </select>
            <div className="text-xs text-gray-500 ml-auto flex items-center gap-2">
              <span>{displayRows.length.toLocaleString()} of {rowsDesc.length.toLocaleString()}</span>
              <span className="text-gray-400">·</span>
              <span>Sum: <span className="font-semibold text-gray-900">{fmtUSD(displayRows.reduce((s, t) => s + (Number(t.amount) || 0), 0))}</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                <tr>
                  <th className="text-left px-3 py-2 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('date')}>Date{sortIcon('date')}</th>
                  <th className="text-left px-3 py-2 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('description')}>Description{sortIcon('description')}</th>
                  <th className="text-left px-3 py-2 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('category')}>Category{sortIcon('category')}</th>
                  <th className="text-left px-3 py-2 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('type')}>Type{sortIcon('type')}</th>
                  <th className="text-right px-3 py-2 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('amount')}>Amount{sortIcon('amount')}</th>
                  <th className="text-right px-3 py-2 cursor-pointer hover:text-gray-900" onClick={() => toggleSort('running_balance')}>Balance{sortIcon('running_balance')}</th>
                  <th className="w-10 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayRows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">No transactions match.</td></tr>
                ) : displayRows.map(t => {
                  const isEditing = editingId === t.id
                  const delta = txDelta(t, account.type)
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
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="Edit category/notes">
                                <Edit2 size={13}/>
                              </button>
                              {t.type === 'Expense' && (
                                <button onClick={() => startPromote(t)} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600" title="Promote to recurring bill">
                                  <ArrowUpRight size={13}/>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                      {isEditing && (
                        <tr className="bg-blue-50/40">
                          <td colSpan={7} className="px-3 py-3">
                            <div className="flex flex-col md:flex-row gap-2 md:items-end">
                              <label className="flex-1">
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Category</span>
                                <select
                                  value={editCategory}
                                  onChange={e => { setEditCategory(e.target.value); setEditSubCategory('') }}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                  autoFocus
                                >
                                  <option value="">— Select —</option>
                                  {catList.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </label>
                              <label className="flex-1">
                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sub-category</span>
                                <select
                                  value={editSubCategory}
                                  onChange={e => setEditSubCategory(e.target.value)}
                                  disabled={!editCategory || subCatOptions.length === 0}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                >
                                  <option value="">{subCatOptions.length === 0 ? '—' : '— None —'}</option>
                                  {subCatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
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

      {/* Promote-to-bill modal */}
      {promoteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={cancelPromote}>
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Promote to Recurring Bill</h3>
              <button onClick={cancelPromote} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <div className="p-4 space-y-3">
              {promoteError && <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">{promoteError}</div>}
              <label className="block">
                <span className="block text-xs font-semibold text-gray-700 mb-1">Bill Name</span>
                <input type="text" value={promoteName} onChange={e => setPromoteName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">Category</span>
                  <input type="text" value={promoteCategory} onChange={e => setPromoteCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">Account</span>
                  <input type="text" value={promoteAccount} onChange={e => setPromoteAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">Amount</span>
                  <input type="number" step="0.01" value={promoteAmount} onChange={e => setPromoteAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">Frequency</span>
                  <select value={promoteFrequency} onChange={e => setPromoteFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400">
                    <option>Monthly</option>
                    <option>Biweekly</option>
                    <option>Weekly</option>
                    <option>Quarterly</option>
                    <option>Annual</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs font-semibold text-gray-700 mb-1">Due Day</span>
                  <input type="number" min="1" max="31" value={promoteDueDay} onChange={e => setPromoteDueDay(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400" />
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={cancelPromote} disabled={promoteSaving}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={submitPromote} disabled={promoteSaving}
                  className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {promoteSaving ? 'Creating…' : 'Create Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
